#!/usr/bin/env bun
/**
 * Generate anonymized benchmark test cases from real convicted predator chat logs.
 *
 * Reads scraped Perverted Justice JSONL, picks the 10 cases with most turns
 * (that have both predator + decoy roles), anonymizes all names, splits each
 * full conversation into 200-turn sequential chunks, and writes
 * benchmark/suites/grooming-real.json.
 *
 * This ensures the model is tested on the ENTIRE conversation, not just fragments.
 *
 * Usage:
 *   bun run cli/generate-real-cases.ts              # generate suite file
 *   bun run cli/generate-real-cases.ts --dry-run    # just show selected cases
 */

import { resolve } from "path";

const RAW_DATA = process.env.RAW_DATA_PATH
  ? resolve(process.env.RAW_DATA_PATH)
  : resolve(import.meta.dir, "../data/full_scraped_cases_v2.jsonl");
const OUTPUT_FILE = resolve(import.meta.dir, "../suites/grooming-real.json");

const NUM_CASES = 10;
// ~20,000 turns ≈ 160K tokens — fits in the smallest model context (DeepSeek 164K).
// Larger models (Opus 1M, Gemini 1M, Grok 2M) will fit entire cases in one call.
const CHUNK_SIZE = 20_000;

// Fake name pairs for anonymization (predator, decoy)
const FAKE_NAMES: Array<[string, string]> = [
  ["tyler_m", "ashley_r"],
  ["brandon_w", "jessica_h"],
  ["chris_d", "megan_s"],
  ["derek_p", "kayla_n"],
  ["jason_k", "hannah_l"],
  ["mike_j", "emma_k"],
  ["ryan_b", "sarah_t"],
  ["steve_c", "nicole_g"],
  ["dave_r", "amber_w"],
  ["kevin_f", "rachel_v"],
];

// Grooming stage patterns — mirrors convert_to_training.py
const STAGE_PATTERNS: Record<string, RegExp> = {
  age_probing: new RegExp(
    "how old|what grade|r u|a/?s/?l\\b|what school|" +
      "\\bage\\b|how old r u|how old are (u|you)|" +
      "what year.*(born|school|r u)|u in (middle|high) school|" +
      "what.?s (ur|your) (age|grade|birthday)|when.*(born|birthday)|" +
      "(are|r) (u|you) (under|\\d{1,2})|" +
      "(young|younger|oldest|underage|jailbait|minor)|" +
      "too young|2 young|how many years",
    "i"
  ),
  trust_building: new RegExp(
    "you.?re (so |really |very )?(special|mature|beautiful|pretty|cute|hot|sexy|amazing|sweet|gorgeous)|" +
      "(u r|ur|you are|youre) (so |really )?(special|mature|beautiful|pretty|cute|hot|sexy|sweet|gorgeous)|" +
      "you can trust|i (really |truly )?(care|love|like) (u|you)|" +
      "i.?ll (buy|get|send) (u|you)|" +
      "(love|luv|lov) (u|you|ya)|i (like|luv|lov) u|" +
      "\\bbabe\\b|\\bbaby\\b|\\bhon\\b|\\bhun\\b|\\bhoney\\b|\\bsweetheart\\b|\\bsweetie\\b|\\bprincess\\b|" +
      "(miss|missed|missing) (u|you)|thinking (of|about|bout) (u|you)|" +
      "(u r|you are|ur|youre) (different|not like|unlike)|" +
      "no one (else )?(understands|gets) (u|you)|" +
      "(buy|get|give) (u|you) (a |some )?(gift|present|money|phone|clothes)|" +
      "i (wanna|want 2|want to|wana) (be with|hold|hug|kiss|cuddle|snuggle) (u|you)|" +
      "(promise|swear) (i |ill )?(won.?t|not).*(hurt|tell|leave)|" +
      "we.*(special|connection|bond|meant to be)|" +
      "(nobody|no one).*(love|care|treat) (u|you) like",
    "i"
  ),
  isolation: new RegExp(
    "don.?t tell|dont tell|" +
      "keep.*(secret|between us|private|quiet|hush)|" +
      "(your|ur) (parents?|mom|dad|mother|father|family).*(don.?t|won.?t|wouldn.?t|cant|can.?t)|" +
      "delete (this|the|these|ur|your) (message|chat|text|pic|convo)|" +
      "(don.?t|dont) (say|tell) (anyone|anybody|no one|noone|nobody|ur|your)|" +
      "(they|them|people|friends|parents).*(won.?t|wouldn.?t|don.?t|cant) understand|" +
      "(just|only) between (us|u and me|me and u)|" +
      "(erase|clear|delete) (the|ur|your|this) (history|chat|convo|log)|" +
      "(don.?t|dont) (get|want).*(in trouble|caught|busted)|" +
      "(if|when).*(mom|dad|parents?|family).*(find|found|know|knew|see|saw) out|" +
      "(are|r) (u|you|your|ur).*(parents?|mom|dad).*(home|there|around|awake|asleep|sleep|gone|away)|" +
      "(is|are) (anyone|anybody|someone).*(home|there|around|near)|" +
      "(u|you) (home )?alone|alone.*(house|home|room)",
    "i"
  ),
  location_probing: new RegExp(
    "where (do you|do u|u|you) live|what.?s (ur|your) address|" +
      "what (city|town|state|area|neighborhood|zip)|" +
      "are (you|u).*(home|alone)|" +
      "where (is|r) (ur|your) (school|house|place|home|apt|apartment)|" +
      "(what|where).*(ur|your) (house|place|home|apartment|street)|" +
      "(how far|how close|near|close to) (are you|r u|u from)|" +
      "what part of (town|the city|\\w+)|" +
      "give me (ur|your) (address|directions|location)|" +
      "(where|wat) (area|part of town)|" +
      "(what|whats|wat) (ur|your) (zip|zip code|postal)",
    "i"
  ),
  contact_escalation: new RegExp(
    "(give|send|gimme) me (ur|your) (number|phone|snap|cell|digits)|" +
      "(do you|do u|u|you) have (snap|insta|kik|whatsapp|telegram|signal|discord|tiktok|ig)|" +
      "(text|call|hit) me|add me on|" +
      "let.?s (talk|chat|move|go).*(snap|insta|kik|phone|text|private|somewhere else)|" +
      "(what.?s|whats|give me) (ur|your) (number|cell|snap|insta|screen ?name|user ?name)|" +
      "(i.?ll|ill|lemme) (call|text|hit) (u|you)|" +
      "(can i|lemme) (get|have) (ur|your) (number|digits|cell|phone)|" +
      "(talk|chat) on the phone|" +
      "(my|here.?s my) (number|cell|phone|snap)",
    "i"
  ),
  explicit_solicitation: new RegExp(
    "send.*(pic|photo|selfie|nud|image|vid)|" +
      "(show|lemme see) (me |ur |your )?(body|boobs|chest|butt|privates|self)|" +
      "what (are|r) (u|you) wearing|take (off|it off)|" +
      "turn on.*(camera|cam|webcam)|" +
      "\\b(sex|f[u*]ck|suck|blow ?job|hand ?job|oral|bj|hj)\\b|" +
      "(wanna|want 2|want to|wana|like 2|like to) (do it|f[u*]ck|have sex|fool around|hook ?up|mess around)|" +
      "(can i|i wanna|i wana|i want 2|i want to|lemme) (eat|lick|touch|feel|taste|finger|rub) (u|you|ur|your)|" +
      "(have you|u) ever (done it|had sex|been with|hooked up|messed around|been touched)|" +
      "(play with|touch) (ur|your|my) (self|body|privates)|" +
      "(hard|horny|turned on|wet|erect|aroused)\\b|" +
      "(take|send).*(clothes off|naked|nude|underwear|bra|panties)|" +
      "(cum|orgasm|climax|get off|jerk|jack|stroke|masturba)|" +
      "let.?s (trade|swap|exchange).*(pic|photo|image)|" +
      "(u|you) (make|made) me (hard|horny|excited|cum)|" +
      "(what|wat) (would|wud|wld) (u|you) do (to|2|with) me|" +
      "(ever )?(touch|play with) (ur ?self|yourself)|" +
      "(cyber|phone sex|cam 2 cam|c2c)",
    "i"
  ),
  meeting_requests: new RegExp(
    "(can|let.?s|want to|wanna|wana|want 2|gonna|going to|we should) meet|" +
      "(can|let.?s|want to|wanna|wana|want 2) (hang|hang out|chill|kick it|get together|link up|hook up)|" +
      "i.?ll (come|pick (u|you) up|drive|be there)|" +
      "come (to|over|2).*(house|place|hotel|motel|apartment|apt|room|car)|" +
      "(meet|see) (u|you) (at|in|on|this) (sat|sun|mon|tue|wed|thu|fri|weekend|tomorrow|today|tonight)|" +
      "(u|you) (wanna|want 2|want to|wana) come (over|here|to my)|" +
      "(where|when) (should|can|do) (we|i) meet|" +
      "(i.?ll|ill) (bring|get) (condom|protection|stuff)|" +
      "(get|got) a (hotel|motel|room)|" +
      "(u|you) (free|available|busy|around) (this |on |)(sat|sun|weekend|tomorrow|tonight|friday)|" +
      "(pick|picking) (u|you) up|" +
      "(what|wat) time.*(come|meet|get there)|" +
      "i.?ll be (there|at|outside|waiting)|" +
      "(meet|see) (u|you) (soon|then|there|later)|" +
      "(u|you) (want 2|wanna|want to|wana) (see|visit|come see) me",
    "i"
  ),
  coercion_threats: new RegExp(
    "i.?ll (tell|show|send|post) (everyone|your|the|it to)|" +
      "no one will believe|" +
      "(you.?ll|ull|u will) (get|be) in trouble|" +
      "(if you|if u) (tell|say|don.?t|dont)|" +
      "(i.?ll|ill) (ruin|destroy|hurt|kill) (u|you|ur|your|myself)|" +
      "(nobody|no one) (will|would) believe (u|you)|" +
      "(ur|your|you.?re) (fault|to blame)|it.?s (ur|your) fault|" +
      "(u|you) (owe|promised|said you would)|" +
      "(u|you) (led|lead) me on|" +
      "(after|everything).*(i.?ve|ive|i) (done|did|given|bought)|" +
      "(kill|hurt) (myself|my ?self) if (u|you)|" +
      "(thought|think) (u|you) (loved|liked|cared)",
    "i"
  ),
};

interface RawTurn {
  speaker: string;
  message: string;
}

interface RawCase {
  archive_id: string;
  predator_name: string;
  decoy_name: string;
  role_map: Record<string, string>;
  turns: RawTurn[];
}

interface BenchmarkTestCase {
  id: string;
  category: string;
  source: "real";
  case_id: string;
  chunk: string; // e.g. "1/88" — position in the full conversation
  messages: Array<{ role: string; text: string }>;
  expected: {
    is_grooming: boolean;
    stages: string[];
  };
}

function detectStages(messages: Array<{ text: string }>): string[] {
  const combined = messages.map((m) => m.text).join(" ");
  const detected: string[] = [];
  for (const [stage, pattern] of Object.entries(STAGE_PATTERNS)) {
    if (pattern.test(combined)) {
      detected.push(stage);
    }
  }
  return detected.length > 0 ? detected : ["general"];
}

function anonymizeText(
  text: string,
  replacements: Map<string, string>
): string {
  let result = text;
  // Sort replacements longest-first to avoid partial match conflicts
  const sorted = [...replacements.entries()].sort(
    (a, b) => b[0].length - a[0].length
  );
  for (const [original, fake] of sorted) {
    if (original.length >= 2) {
      result = result.replace(new RegExp(escapeRegex(original), "gi"), fake);
    }
  }
  return result;
}

/** Build extended replacement map including name fragments from screen names. */
function buildReplacements(
  roleMap: Record<string, string>,
  predatorName: string,
  decoyName: string,
  fakePred: string,
  fakeDecoy: string
): Map<string, string> {
  const map = new Map<string, string>();

  // Common English words that happen to match name fragments — skip these
  const skipWords = new Set([
    "miss", "love", "hot", "the", "is", "are", "my", "me", "do", "a",
    "in", "on", "it", "be", "so", "go", "no", "up", "to", "or", "an",
    "man", "guy", "here", "show", "dog", "all", "day", "new", "big",
    "not", "one", "two", "for", "her", "him", "his", "she", "you",
    "was", "had", "has", "but", "out", "get", "got", "put", "did",
    "too", "see", "old", "use", "its", "let", "say", "any", "can",
  ]);

  const addFragments = (fullName: string, fakeName: string) => {
    if (fullName.length >= 2) map.set(fullName, fakeName);

    const fragments = fullName.split(/[_\-\d@.]+/).filter(Boolean);
    for (const frag of fragments) {
      if (
        frag.length >= 4 &&
        !skipWords.has(frag.toLowerCase()) &&
        !map.has(frag)
      ) {
        const fakeFirst = fakeName.split("_")[0];
        map.set(frag, fakeFirst);
      }
    }
  };

  for (const [speaker, role] of Object.entries(roleMap)) {
    if (role === "predator") {
      addFragments(speaker, fakePred);
    } else if (role === "decoy") {
      addFragments(speaker, fakeDecoy);
    }
  }

  addFragments(predatorName, fakePred);
  addFragments(decoyName, fakeDecoy);

  return map;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function main() {
  const dryRun = Bun.argv.includes("--dry-run");

  // Read raw data
  const rawText = await Bun.file(RAW_DATA).text();
  const lines = rawText.split("\n").filter((l) => l.trim());

  // Parse and filter cases with both roles
  const cases: RawCase[] = [];
  for (const line of lines) {
    const record = JSON.parse(line) as RawCase;
    const roles = new Set(Object.values(record.role_map || {}));
    if (roles.has("predator") && roles.has("decoy") && record.turns.length > 0) {
      cases.push(record);
    }
  }

  // Sort by turn count descending and pick top N
  cases.sort((a, b) => b.turns.length - a.turns.length);
  const selected = cases.slice(0, NUM_CASES);

  if (dryRun) {
    console.log(`Selected ${selected.length} cases:`);
    let totalChunks = 0;
    for (let i = 0; i < selected.length; i++) {
      const c = selected[i];
      const chunks = Math.ceil(c.turns.length / CHUNK_SIZE);
      totalChunks += chunks;
      console.log(
        `  ${i + 1}. ${c.archive_id} (${c.turns.length} turns, ~${chunks} chunks) ` +
          `pred=${c.predator_name} decoy=${c.decoy_name}`
      );
    }
    console.log(`\nTotal estimated chunks: ${totalChunks}`);
    process.exit(0);
  }

  const testCases: BenchmarkTestCase[] = [];
  let caseNum = 0;

  for (const rawCase of selected) {
    const [fakePred, fakeDecoy] = FAKE_NAMES[caseNum];
    caseNum++;

    const replacements = buildReplacements(
      rawCase.role_map,
      rawCase.predator_name,
      rawCase.decoy_name,
      fakePred,
      fakeDecoy
    );

    // Map ALL turns to training format (full conversation)
    const cleanTurns: Array<{ role: string; text: string }> = [];
    for (const turn of rawCase.turns) {
      const speaker = (turn.speaker || "").trim();
      const mappedRole = rawCase.role_map[speaker];
      if (!mappedRole || (mappedRole !== "predator" && mappedRole !== "decoy")) {
        continue;
      }
      const trainingRole = mappedRole === "predator" ? "other" : "self";
      const anonText = anonymizeText((turn.message || "").trim(), replacements);
      if (anonText.length > 0) {
        cleanTurns.push({ role: trainingRole, text: anonText });
      }
    }

    if (cleanTurns.length < 3) continue;

    // Split into sequential non-overlapping chunks of CHUNK_SIZE
    const totalChunks = Math.ceil(cleanTurns.length / CHUNK_SIZE);

    for (let ci = 0; ci < totalChunks; ci++) {
      const start = ci * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, cleanTurns.length);
      const chunkMsgs = cleanTurns.slice(start, end);

      // Skip very short trailing chunks (< 10 turns)
      if (chunkMsgs.length < 10) continue;

      // Ensure both roles present
      const roles = new Set(chunkMsgs.map((m) => m.role));
      if (roles.size < 2) continue;

      const stages = detectStages(chunkMsgs);
      const primaryStage = stages[0];

      const id = `real-${String(testCases.length + 1).padStart(4, "0")}`;

      testCases.push({
        id,
        category: primaryStage,
        source: "real",
        case_id: fakePred,
        chunk: `${ci + 1}/${totalChunks}`,
        messages: chunkMsgs,
        expected: {
          is_grooming: true,
          stages,
        },
      });
    }

    console.log(
      `  ${fakePred}: ${cleanTurns.length} turns -> ${totalChunks} chunks`
    );
  }

  // Build suite object
  const suite = {
    suite: "grooming-real",
    version: "2.0",
    description: `Full convicted predator chat logs (anonymized) — ${NUM_CASES} cases, ${CHUNK_SIZE}-turn sequential chunks covering entire conversations`,
    tests: testCases,
  };

  // Write suite file
  await Bun.write(OUTPUT_FILE, JSON.stringify(suite, null, 2));
  console.log(`\nWrote ${testCases.length} test cases to ${OUTPUT_FILE}`);
  console.log(`Generated from ${caseNum} convicted cases`);

  // Per-case summary
  const caseCounts: Record<string, number> = {};
  for (const tc of testCases) {
    caseCounts[tc.case_id] = (caseCounts[tc.case_id] || 0) + 1;
  }
  console.log("\nPer-case chunk counts:");
  for (const [caseId, count] of Object.entries(caseCounts).sort(
    (a, b) => b[1] - a[1]
  )) {
    console.log(`  ${caseId}: ${count} chunks`);
  }

  // Stage distribution
  const stageCounts: Record<string, number> = {};
  for (const tc of testCases) {
    for (const s of tc.expected.stages) {
      stageCounts[s] = (stageCounts[s] || 0) + 1;
    }
  }
  console.log("\nStage distribution:");
  for (const [stage, count] of Object.entries(stageCounts).sort(
    (a, b) => b[1] - a[1]
  )) {
    console.log(`  ${stage}: ${count}`);
  }

  // Verify anonymization
  const outputText = JSON.stringify(suite);
  const leaks: string[] = [];
  for (const c of selected) {
    if (outputText.includes(c.archive_id)) {
      leaks.push(c.archive_id);
    }
    if (outputText.includes(c.predator_name)) {
      leaks.push(c.predator_name);
    }
    if (outputText.includes(c.decoy_name)) {
      leaks.push(c.decoy_name);
    }
  }
  if (leaks.length > 0) {
    console.error(
      `\nWARNING: Found un-anonymized names in output: ${leaks.join(", ")}`
    );
    process.exit(1);
  } else {
    console.log("\nAnonymization check: PASSED (no original names found in output)");
  }

  // Cost estimate
  const avgTokensPerTurn = 15; // rough estimate: ~15 tokens per message
  const totalTokens = testCases.reduce(
    (sum, tc) => sum + tc.messages.length * avgTokensPerTurn,
    0
  );
  console.log(
    `\nEstimated tokens per model run: ~${(totalTokens / 1_000_000).toFixed(2)}M input tokens`
  );
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
