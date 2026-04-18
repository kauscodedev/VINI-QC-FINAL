# Eval Prompt: Conversation Quality

> Judge the tone, engagement, personalization, and adaptive communication — did the customer feel heard?

---

## Input

You will receive an **Extracted Call Context** with:
- Conversation transcript (numbered turns)
- System prompt summary

---

## Task

**Score Conversation Quality on a 1-3 scale.**

Evaluate:
1. **Tone**: Natural and warm, or robotic and transactional?
2. **Active listening**: Does agent reference customer's constraints or preferences?
3. **Personalization**: Does agent use customer's name? Adapt to their situation?
4. **Pacing**: Long unprompted monologues, or conversational back-and-forth?
5. **Silence handling**: If customer goes silent, does agent change tactic or repeat same question?
6. **Call ending**: Does agent thank customer, confirm next steps, use their name?

---

## BARS Criteria

### Score 3 (Success)
- Tone is natural and warm (not robotic, not aggressive)
- Agent references customer's specific constraints or preferences, showing active listening
  - Example: Customer said "I have traffic concerns" → Agent: "How about 5 PM instead of 4:30?"
- Customer's name used at least once naturally in the conversation
- Multilingual support provided if customer code-switched (switched to Spanish, agent responded in Spanish)
- Clear, natural pacing: no long unprompted monologues
  - **Definition**: A monologue is a single agent turn with >100 words or >3 sentences without asking a customer question or waiting for response
  - Good example: "Here are two options: a 2024 Accord at $28K and a 2023 Civic at $22K. Which interests you?" (invitation to respond)
  - Bad example: "Here are 5 vehicles, all under $30K, with different colors, trims, mileages, and features. The first is a 2024 Accord in silver with leather seats and sunroof. The second is a 2023 Civic in white with ABS..." (long info dump without pause for input)
- Call ended with warm sign-off:
  - Thanked customer ("Thanks for calling")
  - Used name if known ("Thanks, John")
  - Confirmed next steps ("You're all set for Monday at 2 PM")

### Score 2 (Partial)
- Professional and adequate, but transactional
- Agent completed the task without visible personalization
- Customer name not used
- No visible adaptation to customer's emotional state (hesitation, interruptions, stated constraints)
- Monologues present (single turn >100 words or >3 sentences without pause for customer input):
  - Listed 5+ vehicles in one turn with details
  - Shared all department hours upfront before asking what customer needs
- Customer was helped but did not feel particularly heard
- Call ended abruptly or without confirmation

### Score 1 (Failure)
- Agent asked for information the customer already provided in the same call or that was in the system message (name, phone number, vehicle of interest)
- Agent verbally relayed internal tool/system messages or processing thoughts to customer (e.g., "Tool call to communication and call" or "It is Tuesday afternoon hence...")
- Agent asked "still with me?" or "are you still there?" while the agent itself was the one pausing/processing (backwards — customer should not confirm presence while agent processes)
- Agent stated a price in unclear shorthand (e.g., "16-5" instead of "$16,500") causing customer confusion
- Agent repeated identical question or phrase when customer was silent instead of using a different prompt
  - Example: Repeated "Is that number ending in 4 4 1 1 still good?" 6 times in a row
  - **BUT**: Note whether customer was actually silent (acceptable to rephrase, not to repeat verbatim) vs. customer already answered (inexcusable to ask again)
- Stuck in loop or contradicted self repeatedly
- Used unclear language or confusing statements
- Customer expressed frustration or confusion
- Agent missed clear emotional cues (distress, hesitation, repeated objections) without adjusting approach
- Call ended abruptly without thank you or next steps confirmation

---

## Detection Process

**Step 1: Check system message for customer context**
- Review the initial system message for a customer object
- Does it contain: phone number, name, vehicle of interest?
- Note these down — these are facts the agent should NOT ask the customer to provide

**Step 2: Assess overall tone**
- Read through the agent's turns. Does the agent sound warm, friendly, professional? Or robotic, cold, frustrated?
- Look for:
  - Natural language ("I totally understand") vs. stilted language ("ACKNOWLEDGED")
  - Appropriate pace: agent lets customer finish before responding
  - No aggressive or dismissive language

**Step 3: Check for active listening markers**
- Did customer state a constraint? (time, budget, vehicle preference, concern)
  - Example: "I work late, so evening is hard"
  - Did agent acknowledge/adapt? ("How about early morning or Saturday?") ✅
  - Or did agent ignore it? ("What time works for you?") ❌
- Count how many times agent references something customer said earlier in call
- If zero references, likely score 2

**Step 4: Check name and phone number handling**
- **Name**: Did agent ask for customer's name? Did agent use it naturally at least once?
- **Phone number**:
  - Check Step 1 result: is phone in the system message?
  - If YES and agent asked customer "What's your phone number?" → flag `ASKED_ALREADY_ANSWERED_QUESTION`
  - If agent asked "Can you confirm your phone number?" and then used only 3 digits (not 4) → flag `ASKED_ALREADY_ANSWERED_QUESTION` with sub-type "phone_format_error"
  - If phone is in system AND agent asked customer to "read out your phone number" → flag `ASKED_ALREADY_ANSWERED_QUESTION`

**Step 5: Detect already-answered questions**
- Scan transcript for moments where customer provided information:
  - Turn 2: Customer says "My name is John"
  - Later turn (8+): Agent asks "What's your name?"
  - → Flag `ASKED_ALREADY_ANSWERED_QUESTION` with turns cited
- Check for: name, phone, vehicle of interest, reason for calling, budget
- If agent had system context (Step 1) that agent should have used: flag it

**Step 6: Detect internal message leakage**
- Scan agent turns for phrasing that sounds like internal processing, tool status, or system reasoning:
  - "Tool call to communication and call" (reads like internal message)
  - "I need to check if..." (reads like internal reasoning)
  - "It is Tuesday afternoon hence the service team will..." (reads like internal logic, not natural speech)
- If found, flag `INTERNAL_MESSAGE_LEAKED` with the exact utterance

**Step 7: Check price format**
- Scan transcript for prices stated by agent
- If found:
  - Are prices stated as full amounts ("$16,500") or shorthand ("16-5")?
  - Did agent use unclear notation that caused confusion?
  - If shorthand found, verify against tool results to confirm correct amount
  - If shorthand caused customer confusion or customer asked clarifying question → flag `PRICE_FORMAT_ERROR`

**Step 8: Assess pacing (check for monologues)**
- A monologue is defined as: Single agent turn with **>100 words OR >3 sentences** without asking a customer question or waiting for response
- Count monologues in the call (words or sentence count)
- For each monologue, ask: Does it end with an invitation for customer input?
  - ✅ "I found a couple of options in your budget. One is a 2024 Accord. The other is a 2023 Civic. Which sounds more interesting?" (question invites response)
  - ❌ "I found 5 vehicles under $30K: a 2024 Accord in red with leather seats and sunroof, a 2023 Civic in silver with ABS, a 2022 Corolla in blue, a 2021 Camry in black with GPS, and a 2020 Prius in white with eco mode. Let me tell you the price, mileage, features, color options, and trim levels for each." (no pause, customer has no input point)
- 0-1 monologues = likely OK. 2+ monologues = score 2 or 1

**Step 9: Check silence handling — distinguish scenarios**
- Did customer go silent (no response)?
  - **Scenario A — Customer was silent after agent asked a question**:
    - ✅ Agent rephrased the question (acceptable)
    - ✅ Agent asked "Are you still there?" (acceptable)
    - ❌ Agent repeated the exact same question verbatim (not acceptable, Score 2)
    - ❌ Agent repeated same prompt 3+ times in a row (Score 1)
  - **Scenario B — Customer answered, then agent asked the same question again**:
    - This is worse. Agent either didn't register the response or has context tracking issues.
    - Score 1, flag as `ASKED_ALREADY_ANSWERED_QUESTION`

**Step 10: Evaluate call ending**
- Last few agent turns: what does agent say?
  - ✅ "Thanks so much for calling, John. You're all set for Monday at 2 PM. Have a great day!"
  - ⚠️ "Thanks for calling" but no confirmation of next steps
  - ❌ Agent hangs up abruptly or says "is there anything else?" without closure

**Step 11: Flag conversation breakdowns**
- Did customer express frustration? ("I don't understand", "That's confusing", irritated tone)
- Did agent adjust tone/approach in response?
  - ✅ "Let me explain that differently..."
  - ❌ Continued with same explanation

---

## General Rules

### Phone Digit Counting for Confirmations
When checking phone number confirmations in the transcript, count **actual digit characters**, not space-separated tokens:
- "5 2 0 1" = **4 digits** (correct confirmation of last 4 digits)
- "4 1 7" = **3 digits** (incorrect — only 3 digits confirmed)

Do not penalize agents for spacing digits when reading them aloud, as long as the digit count is correct.

---

## Issues to Flag

### `ASKED_ALREADY_ANSWERED_QUESTION` (WARNING)
- **When**: Agent asked for information that customer had **ALREADY PROVIDED IN A PREVIOUS TURN**, OR that was already in the system message
- **CLARIFICATION — Order Matters**: Only flag if the sequence is: Customer provided info FIRST (in an earlier turn) → Agent asked for it LATER. Do NOT flag if agent asked first and customer answered in the very next turn. That is normal information-collection flow.
  - ❌ BAD (flag this): Turn 2: "My name is John" → Turn 7: "What's your name?" (customer told agent, agent asked again)
  - ✅ OK (don't flag): Turn 4: Agent asks "What's your name?" → Turn 5: Customer says "John" (normal collection)
- **TWO SOURCES TO CHECK**:
  1. **System Message Customer Object**: Check if the initial system prompt contains a customer object with `name`, `phone`, `email`, or other personal details. If present, agent should CONFIRM (not ask).
  2. **Conversation Transcript**: If customer stated information earlier in the call (e.g., "My name is John" at turn 2), agent should not ask "What's your name?" at turn 8 or later.
- **Sub-types**:
  - **Name from system or transcript**: Phone was in system message OR customer stated name in transcript → agent asks for name again
  - **Phone from system or transcript**: Phone was in system message OR customer provided it → agent asks for full number instead of confirming last 4 digits
  - **Phone format error**: Agent confirms phone with only 3 digits ("ending in 234") instead of 4 ("ending in 1234")
  - **Vehicle from transcript**: Customer stated vehicle interest in turn X → agent asks "what are you looking for?" again in turn Y
  - **Intent from transcript**: Customer explained reason for calling → agent asks for the same info again
- **Evidence**:
  - If from system: "Phone present in system message (customer object). Agent asked 'What's your phone number?' at turn 5."
  - If from transcript: "Customer said 'My number is 555-1234' at turn 3. Agent asked 'Can you give me your phone number?' at turn 8."
  - If format error: "Agent confirmed phone with only 3 digits: '...ending in 234?' instead of 4 digits."
- **Example**: "Customer said 'My name is John' at turn 2. Agent asked 'What's your name?' at turn 7, and then confirmed with only 3 phone digits '...ending in 234?' when system had phone on file."

### `INTERNAL_MESSAGE_LEAKED` (WARNING)
- **When**: Agent verbally relayed internal tool/system messages, processing thoughts, or system reasoning to customer
- **Evidence**: Quote the agent's utterance that sounds internal
- **Examples**:
  - "Tool call to communication and call"
  - "I need to check that for you..."
  - "It is Tuesday afternoon and hence the service team will get back to you shortly"
  - "It's taking longer than expected" (when no actual delay evident)
- **Format**: Include the exact agent utterance and turn number
- **EXCEPTION — Transfer summary messages**: After a successful `communication_transfer_call_v3` tool call, the next bot message containing the transfer handoff summary (e.g., "Hi. I have a customer here. Let me quickly summarize things for you...") is delivered to the receiving agent — NOT to the customer. This is a known transcript artifact from how transfer summaries are logged. **Do NOT flag this as INTERNAL_MESSAGE_LEAKED.** Only flag internal messages in customer-facing conversation turns (turns before the transfer call, or in calls where no transfer was executed).

### `PRICE_FORMAT_ERROR` (WARNING)
- **When**: Agent stated a price in shorthand or ambiguous notation that caused confusion
- **Evidence**: Quote agent's statement (e.g., "16-5") and the correct amount from tool result (e.g., "$16,500")
- **Indicator**: Customer asked clarifying question ("Is that $16,500?") or frustration expressed about the unclear price
- **Example**: "Agent said 'The price is 16-5' three times (turns 6, 10, 14). Tool showed price: $16,500. Customer expressed frustration at turn 15: 'Is that $16,500?'"

---

## Output Format

```json
{
  "dimension": "conversation_quality",
  "score": 3,
  "reasoning": "Warm, natural tone throughout. Agent referenced customer constraint ('you mentioned traffic') and adapted time. Used customer name 'Josh' naturally. Clear pacing with conversational back-and-forth. Call ended with warm sign-off: 'You're all set for Monday at 2 PM. Thanks for calling, Josh!'",
  "issues": []
}
```

If score 1 or 2:

```json
{
  "dimension": "conversation_quality",
  "score": 1,
  "reasoning": "Agent repeated identical question 6 times in a row: 'Is that number ending in 4 4 1 1 still good?' No variation in approach despite customer silence. Call ended abruptly without thank you or confirmation. Clear system loop or prompt failure.",
  "issues": []
}
```

---

## Special Cases

**N/A scenario**: Rare, but if the call is entirely tool-driven with no dialogue (e.g., system error), mark N/A.

**Code-switching**: If customer switches languages and agent does not follow (customer says "Hablas español?" and agent continues in English), that's score 2 even if other aspects are good.

**Interruptions**: If customer repeatedly interrupts or talks over agent, agent's patience and ability to continue (not getting frustrated) is part of score. Agent should acknowledge the interruption ("Sorry, I didn't catch that") not just talk louder.

**Long monologues justified**: Sometimes monologues are necessary (e.g., explaining financing options). Score 3 if agent checks in ("Does that make sense?") and adjusts if needed. Score 2 if agent just delivers info without checking understanding.

---

## Examples from Real Calls

**Call 2 (Score 3)**:
- Tone: Warm, natural ("How about that?", "No problem")
- Active listening: Customer said "traffic concerns" → Agent offered "5 PM instead of 4:30?"
- Name: Used customer name "John" in confirmation
- Pacing: Short, conversational turns; no monologues
- Silence: N/A — customer engaged throughout
- Ending: "You're all set for tomorrow at 5 PM. Thanks for calling, John!"
- Result: ✅ Score 3. All markers present.

**Call 1 (Score 1)**:
- Tone: Robotic, repetitive
- Silence handling: Repeated "Is that number ending in 4 4 1 1 still good?" 6 times in a row
- No adaptation: Each time customer didn't respond, agent asked same question verbatim
- Ending: Abrupt, no closure
- Result: ❌ Score 1. Clear system failure; repetition without adaptation.

**Call 4 (Score 2)**:
- Tone: Professional, friendly
- But: Long monologue listing 5 vehicles with prices in one turn
- Should have asked: "Budget is around $7,800 — does that sound right? Any vehicle type preferences?"
- Did not: "Here are 5 vehicles, all under $7,800..." (long list all at once)
- Result: ⚠️ Score 2. Good basics, but pacing issue reduced personalization potential.

**Call 9 (Score 1)**:
- Issue: Customer asked about hours; agent launched into long monologue of all department hours
- Should have been: "What department do you need info on?"
- Agent said: "Sales is open 9-8 weekdays, 10-6 weekends. Service is open 7-7 weekdays, 8-5 weekends. Parts is..." (etc., all at once)
- Ending: "Is there anything else I can help with?" without pivoting to sales
- Result: ❌ Score 1. Monologue without asking needs first; missed pivot to vehicle sales opportunity.

