# Eval Prompt: Lead Qualification & Conversion

> Judge whether the agent discovered customer intent, asked qualifying questions, and moved toward an appointment or next step.

---

## Input

You will receive an **Extracted Call Context** with:
- Conversation transcript (numbered turns)
- Tool calls & results (including `sales_create_meeting` if called)
- System prompt summary

---

## Task

**Score Lead Qualification & Conversion on a 1-3 scale.**

Look for three behaviors:
1. **Intent discovery**: Did agent understand what the customer wants?
2. **Qualification**: Did agent ask about budget, timeline, vehicle preferences?
3. **Conversion attempt**: Did agent book an appointment or offer a callback?

---

## BARS Criteria

### Score 3 (Success)
- Agent identified customer intent (vehicle, timeline, budget)
- Asked ONLY qualifying questions that moved toward finding right vehicle or booking
  - NOT questions that didn't help conversion (e.g., "purchase vs. finance?" when not needed to find vehicle)
  - Only asked when sufficient info from customer was NOT yet available
- Handled at least one objection or hesitation
- Offered HARD appointment slots (two fixed options within next 24 hours)
  - ✅ "We can have you over at 3:30 PM today or 10 AM tomorrow. What works better for you?"
  - ❌ "We're open Monday-Saturday, 9-7 PM. When works for you?"
  - ❌ "When can you come in and test drive it?"
- Booked appointment with confirmed date and time (via transcript or callback scheduling)
  - OR escalated appropriately with clear next steps (e.g., "I'll transfer you to our financing specialist")
- Customer left knowing what happens next
- Call ended with warm sign-off: thanked customer, used their name if known

### Score 2 (Partial)
- Agent identified intent and made an attempt to book
- BUT one or more of:
  - Asked questions that didn't help move toward conversion (e.g., "purchase vs. finance?" when not needed to find vehicle or book)
  - Did not ask necessary qualifying questions (no questions about budget, timeline, vehicle fit when these were unclear)
  - Did not push past first objection (customer said "I need to think about it" and agent didn't probe further)
  - Offered soft appointment slots instead of hard slots ("When works for you?" instead of "3:30 PM today or 10 AM tomorrow?")
  - Did not confirm BOTH date AND time explicitly before booking (assumed "tomorrow" or "afternoon")
  - Booked for a vehicle that tool showed as sold/unavailable without offering an alternative
  - Customer showed continued interest but call ended without confirmed appointment
  - Took more turns than necessary to get to booking (could have consolidated questions or skipped non-essential ones)

### Score 1 (Failure)
- Customer showed a clear buying signal (named specific vehicle, stated timeline, budget confirmed, or explicitly asked "when can I come check it out?")
- AND agent never attempted to book an appointment or offer a callback
- Call ended with no next steps or half-hearted follow-up ("is there anything else I can help with?")
- OR agent booked appointment without first confirming vehicle availability via search

---

## BARS Criteria for Special Call Types

### For `explicit_dept_routing` Calls
(Customer explicitly asks for **service, parts, or finance** by department name)

**Conversion dimension = N/A for these calls.**

This is a non-sales routing call. The agent's job is to route to the correct department; conversion to an appointment is not applicable. Do NOT apply appointment nudge, CALLBACK_BEFORE_NUDGE, or NO_APPOINTMENT_ATTEMPT_BEFORE_ROUTING criteria to these calls. Evaluate the quality of the routing/transfer under the Escalation dimension instead.

Return: `"score": "N/A", "reasoning": "Explicit department routing call (service/parts/finance). Conversion not applicable."`.

---

### For `specific_person_routing` Calls
(Customer asks for a specific named person, e.g., "Can I speak to Rhonda Simmons?")

**Score 3 (Success)**
- Agent briefly asked what the call was regarding ("What can I help you with?") before transferring.
- If the call turned out to be sales-related: agent attempted to help and nudged toward appointment before transferring.
- If the call was not sales-related (customer insisted on the specific person): agent transferred cleanly with summary.
- Warm sign-off.

**Score 2 (Partial)**
- Agent transferred without asking what the call was regarding, but transfer was clean and call was likely non-sales.
- Transfer summary incomplete.

**Score 1 (Failure)**
- Agent transferred without any qualification, and the call appeared to have sales potential.
- Transfer failed with no recovery or next step offered.

---

### For `vague_routing` Calls
(Customer says "I need someone," "can I have sales?", "a real person," or generic transfer request)

**The minimum requirement**: Agent MUST ask what the customer needs before routing. Failing to ask = Score 1.

**Score 3 (Success) — Path A: Agent asked intent, no vehicle interest, clean transfer/callback**
- Agent asked what the customer needed (intent qualification).
- Customer showed no vehicle interest (e.g., just wants to talk to someone about a general matter).
- Agent routed cleanly with a transfer or callback. No appointment nudge required — the customer didn't show a sales opportunity.
- Warm sign-off.

**Score 3 (Success) — Path B: Agent asked intent, vehicle interest emerged, appointment nudge attempted**
- Agent asked what the customer needed.
- Customer showed vehicle interest (named a vehicle, asked about price/availability, mentioned budget, etc.).
- Agent engaged on the topic AND attempted appointment nudge with hard slots (two options within 24h).
- Customer either accepted (booked) OR declined after nudge and agent then transferred/scheduled callback.
- Warm sign-off.

**Score 2 (Partial)**
- Agent asked what customer needed. Customer showed vehicle interest. BUT agent went to callback/transfer without attempting appointment nudge.
- Agent asked intent, then engaged, but callback/transfer framing was non-urgent ("what day works for you?").
- Transfer/callback summary was incomplete.

**Score 1 (Failure)**
- Agent did NOT ask what the customer needed before routing (immediate transfer/callback with no qualification).
- Agent asked intent, customer showed vehicle interest, and agent still immediately scheduled callback without any appointment nudge attempt.

---

### For `sales_agent_conversion_attempt` Calls
(Customer already on sales agent, asking to be transferred "to sales" or "to a real person")

**The minimum requirement**: Agent MUST ask what the customer needs before routing. Same rule as vague_routing.

**Score 3 (Success) — Path A: Agent asked intent, no vehicle interest, clean callback**
- Agent asked what the customer needed.
- Customer showed no vehicle interest / just wants a human for a general matter.
- Agent scheduled callback or explained limitation cleanly. No appointment nudge required.
- Warm sign-off.

**Score 3 (Success) — Path B: Agent asked intent, vehicle interest emerged, appointment nudge attempted**
- Agent asked what the customer needed.
- Customer showed vehicle interest (named a vehicle, discussed specs, asked about pricing, etc.).
- Agent engaged and attempted appointment nudge with hard slots (two options within 24h).
- Customer either booked OR declined and agent then transferred/scheduled callback.
- Warm sign-off.

**Score 2 (Partial)**
- Agent asked what customer needed. Customer showed vehicle interest. BUT agent went to callback without attempting appointment nudge.
- Agent engaged but pivoted to callback/transfer when an appointment nudge would have been appropriate.
- Transfer/callback summary was incomplete.

**Score 1 (Failure)**
- Agent did NOT ask what the customer needed before routing (immediate callback/transfer with no qualification).
- Agent attempted to transfer customer to "sales" when customer is ALREADY on the sales agent (routing error).
- Agent said "I can't help you" with zero engagement attempt.

---

### For `out_of_scope_topic` Calls
(Customer raises topic agent should NOT engage with substantively: financing, lease-end, trade-in valuation, price negotiation, incentives, warranty, or operational post-sale questions)

**Call type trigger**: See Detection Step 0.5 below for topic keyword detection.

**Score 3 (Success)**
- Agent clearly acknowledged the topic is out of scope AND will be addressed in person or with the correct team:
  - ✅ "That's something we can go over in detail when you come in"
  - ✅ "Our finance team can walk you through all your options in person"
  - ✅ "We handle that when you visit" (for operational/post-sale questions)
- Agent bridged to appointment with HARD slots (two fixed options within 24h):
  - "Let's get you in: we have [time A] today or [time B] tomorrow. Which works better?"
- OR if customer explicitly declined appointment: agent offered callback/transfer to correct team with urgency framing:
  - ✅ "I'll have our [finance/sales/team] reach out to you right away"
  - ❌ "What day works for a callback?" (non-urgent framing)
- **For negative equity / credit concerns (C.3)**: agent acknowledged it's common AND stated dealership works with all types of credit and equity situations before bridging to appointment or finance team
- Agent NEVER quoted a specific number (rate, APR, payment, discount, trade-in value, rebate, warranty terms, specific lease terms)
- Agent NEVER said "I don't know" or "I can't help" without offering a bridge

**Score 2 (Partial)**
- Agent deflected correctly (did not engage with specifics) BUT:
  - Went straight to callback/transfer without first attempting appointment bridge, OR
  - Bridged to appointment but with soft slots instead of hard slots, OR
  - Urgency framing was missing ("what day works for you?"), OR
  - Gave limited general info ("we have financing options available") but stopped short of specifics and didn't bridge
- For credit concerns: acknowledged concern but didn't reassure or didn't bridge

**Score 1 (Failure)**
- Agent engaged substantively with out-of-scope topic by quoting:
  - Specific interest rate, APR, monthly payment estimate, or down payment amount (financing topics)
  - Specific price discount, "best price is X", or negotiated amount (price negotiation)
  - Specific rebate or incentive amounts (A.5)
  - Warranty terms, CPO coverage specifics, or extended warranty details (B.3)
  - Trade-in valuation estimate over the phone ("I'd say your car is worth about...") (C.1)
  - Specific lease terms (residual value, money factor, mileage cap, early termination fee) (lease-end topics)
- Agent said "I can't help with that" and ended conversation without any bridge or escalation
- Agent gave incorrect scoping ("I can check your financing" when agent has no finance capability)
- For credit concerns: agent implied customer may not qualify or won't be approved without reassurance

---

## Detection Process

**Step 0: Identify call type (from call classification)**
- Is this an `explicit_dept_routing` call where customer asked for **service, parts, or finance** by department name?
  → **Conversion = N/A.** Stop here. Do not score appointment nudge or callback urgency. Evaluate routing under Escalation dimension.
- Is this a `specific_person_routing` call where customer asked for a named individual?
  → Apply `specific_person_routing` BARS above.
- Is this a `vague_routing` call? (Customer said "I need someone," "can I have sales?", or generic transfer request)
  → Apply `vague_routing` BARS.
- Is this a `sales_agent_conversion_attempt` call? (Customer asked for "sales" or "a real person" while already on sales agent)
  → Apply `sales_agent_conversion_attempt` BARS.
- Otherwise, treat as `legitimate_sales` call with standard BARS.

---

**Step 0.5: Check for out-of-scope topic (applies to all call types)**
Scan customer turns for trigger phrases indicating out-of-scope topics:
- **Finance keywords**: rate, APR, monthly payment, down payment, loan, pre-qualification, pre-qual, credit score, co-signer, bankruptcy, repossession, outside financing, 0% financing, dealer financing, bad credit
- **Lease keywords**: lease end, lease-end, turn in (my lease), mileage overage, early termination, lease buyout, lease transfer, assume (a lease)
- **Trade-in keywords**: "what's my car worth", trade-in value, how much for (my trade), ACV, what will you give (me for)
- **Negative equity / credit**: upside down, owe more than it's worth, negative equity, rolled-over balance
- **Price negotiation**: best price, can you do better, match that price, below MSRP, what's your lowest, take anything off, discount, negotiate
- **Incentives/rebates**: what rebates, what incentives, manufacturer discount, military discount (as price topic), manufacturer offer
- **Warranty**: CPO warranty, certified pre-owned warranty, what does warranty cover, extended warranty, warranty claim
- **Operational**: delivery schedule, paperwork, title, registration, accessories, add-ons, second key, owner manual, title question, reg(istration) question

If ANY out-of-scope topic is detected: apply `out_of_scope_topic` BARS above.
- Multiple topics in one call: Check each independently. If agent deflected correctly on all → Score 3. If failed on any → Score 1.
- If BOTH a vehicle search AND an out-of-scope topic occur: Score both separately (Tool Accuracy for search; Conversion for topic handling)

---

**Step 1: Identify buying signals**
- Did customer name a specific vehicle? (e.g., "the 2024 Altima S")
- Did customer state when they can visit? (e.g., "tomorrow", "this weekend")
- Did customer mention budget? (e.g., "around $25K")
- Did customer explicitly ask about availability? (e.g., "when can I come check it out?")
- Did customer discuss a specific vehicle substantively (3+ turns about that vehicle)?
- **NEW — Out-of-stock scenario (A.1)**: Did customer request a specific vehicle/trim that inventory search showed as unavailable (0 results)? If yes, this is a buying signal even without appointment request. Agent should attempt alternative recommendation.

**Step 2: Audit question efficiency**
- List every question agent asked
- For each question, ask: "Does this help move toward finding the right vehicle or booking an appointment?"
  - ✅ Questions that qualify: "What's your budget?", "What size vehicle?" "When can you visit?"
  - ❌ Questions that don't help: "Purchase or finance?" (not needed to book test drive), "What color do you prefer?" (minor detail, not blocking)
- Flag if agent asked questions that prolonged conversation without moving toward conversion
- Count total turns from intent discovery to appointment offer. Did agent take unnecessarily many turns?

**Step 3: Check appointment offer quality**
- When agent offered appointment, were they HARD slots (two fixed times within 24 hours)?
  - ✅ "3:30 PM today or 10 AM tomorrow? Which works better?"
  - ✅ "I have two options: 2:30 PM today or 10 AM tomorrow. Which would you prefer?"
  - ❌ "When would work for you?"
  - ❌ "We're open Monday-Saturday 9-7, what day suits you?"
  - ❌ "When can you come in?"
- If only soft slots offered: Score likely 2 or 1
- Verify slots are within 24h window: one today (if not too late, ~before 5pm) + one tomorrow. If too late for today, offer two tomorrow.

**Step 4: Check for objection handling and reframe-and-drive scenarios**

**General objection handling:**
- If customer showed hesitation, did agent try to overcome it?
- "I need to think about it" → did agent say more than "OK, I can send you info"?
- "Financing is a concern" → did agent offer to verify options or bridge to visit?

**NEW — Out-of-stock reframe (A.1):**
- If inventory search returned no results for customer's specific request:
  - ✅ Score 3 path: Agent stated vehicle status clearly ("I don't have that exact trim right now") → asked about customer's must-have preferences or needs ("What are the key things you're looking for?") → recommended an alternative vehicle from inventory ("I do have a 2024 Altima S with [X features]") → drove to appointment with hard slots
  - ✅ Score 2 path: Agent mentioned alternatives but didn't ask about preferences first, or offered soft slot instead of hard slots
  - ❌ Score 1: Agent confirmed trim unavailable and stopped. No follow-up recommendation or preference exploration.

**NEW — High-mileage reframe (B.6):**
- If customer raised concern about high mileage (stated or implied concern):
  - ✅ Score 3 path: Agent acknowledged mileage ("I see it has 127K miles") → reframed at least one positive angle:
    - Maintenance history via CarFax data ("according to CarFax, it's been well-maintained with regular service")
    - Brand/model reliability reputation ("these models are known for running strong at this mileage")
    - Price-to-value ratio ("at this price point, that mileage is very competitive")
    → drove toward appointment with hard slots ("Let's have you see it in person: [time A] or [time B]?")
  - ✅ Score 2 path: Agent reframed but didn't drive toward appointment, or only reframed without acknowledging mileage first
  - ❌ Score 1: Agent confirmed high mileage, apologized, expressed no confidence in the vehicle, offered no reframe or alternative

**NEW — Negative equity / credit reframe (C.3):**
- If customer raised concern about credit, negative equity, or past financial hardship:
  - ✅ Score 3 path: Agent acknowledged concern empathetically → stated dealership works with buyers in all financial situations ("We work with buyers of all credit backgrounds and equity situations") → bridged to appointment or finance team ("Our finance team can find options that work for you. Let's get you in: [time A] or [time B]?")
  - ✅ Score 2 path: Agent acknowledged concern and bridged, but without reassurance about dealership openness, or offered callback before appointment bridge
  - ❌ Score 1: Agent implied customer may not qualify, avoided the topic, or gave no reassurance or bridge at all

**Step 5: NEW — Check nudge sequence (for routing/conversion_attempt calls)**
- Did agent offer callback or transfer? If yes, check when relative to appointment nudge.
- ✅ Correct order: Agent nudged toward appointment first, then (if customer declined) offered callback/transfer.
- ❌ Wrong order: Agent offered callback/transfer BEFORE attempting any appointment nudge.
- ❌ Missing: Agent offered callback/transfer with no appointment nudge attempt at all.
- If callback/transfer appeared before nudge → flag `CALLBACK_BEFORE_NUDGE`.

**Step 6: NEW — Check information limitation handling**
- Did agent say "I can't provide exact..." or "I don't have access to..." or "I can't quote..." for pricing/rates/trade-in/fees?
- If yes, what did agent do next?
  - ✅ Bridged to appointment: "The exact payment depends on factors we can nail down in person. Let's get you in: [two times]"
  - ❌ Defaulted to callback: "I'll have someone call you back with that information"
- If agent offered callback after limitation without bridging to appointment → this is a `MISSED_APPOINTMENT_OPPORTUNITY` with sub-type "information limitation."

**Step 7: Verify booking or next step**
- Did agent mention scheduling an appointment in the transcript?
  - If YES: Confirm date + time were both explicitly stated or confirmed
  - If NO: Did agent offer a callback? Did agent verbally confirm the callback was scheduled?
- If neither booking nor callback: Score 1
- For callbacks: verify they were framed urgently ("right away," "today," "as soon as possible") NOT with "what day/time works for you?"
- **Callback tool NOT required**: There is no dedicated callback tool in the current agent setup. A callback is considered scheduled if the agent verbally confirmed it in the transcript. Do NOT penalize conversion score for missing a callback tool call.

**Step 8: Check call end**
- Did agent say thank you?
- Did agent use customer's name?
- Did agent confirm next steps? ("You're all set for Monday at 2 PM")

---

## Issues to Flag

### `MISSED_APPOINTMENT_OPPORTUNITY` (WARNING)
- **When**: Customer showed buying signals AND agent never offered appointment or attempted nudge
- **Sub-types**:
  - **Explicit signal**: Customer explicitly asked "when can I come check it out?" or stated timeline/budget/vehicle — agent offered nothing
  - **Vehicle discussed**: Customer called about a specific vehicle + conversation was substantive (3+ turns) + agent had info to offer appointment + no nudge at all
  - **Information limitation**: Agent hit knowledge limit ("can't quote exact price") + offered callback BEFORE attempting appointment bridge
- **Evidence**: Quote customer's signal + note that no `sales_create_meeting` was called + include what agent offered instead
- **Example**: "Customer asked 'when can I come check it out?' and agent found the 2024 Altima S but only offered to send SMS with address, no booking attempt or callback"

### `SOFT_SLOT_OFFERED` (WARNING)
- **When**: Agent asked "when would you like to come in?" or "when works for you?" instead of offering two hard time slots
- **Evidence**: Quote the agent's question + note the correct format should have been "I have [time A] today or [time B] tomorrow. Which works better?"
- **Example**: "Agent asked 'When do you want to come in?' instead of offering '3:30 today or 10 AM tomorrow'"

### `CALLBACK_URGENCY_FAILURE` (WARNING)
- **When**: Agent asked customer to name preferred callback day/time instead of scheduling urgently
- **Evidence**: Quote agent's question + note correct formula is "I'll have someone call you back right away, unless you want them to call you at a specific time"
- **Example**: "Agent asked 'What day works best for a callback?' instead of 'I'll have someone reach out today right away'"

### `CALLBACK_BEFORE_NUDGE` (WARNING)
- **When**: Agent offered callback or transfer BEFORE attempting any appointment nudge
- **Evidence**: Note the turn numbers where callback/transfer was offered vs where appointment nudge first appeared (if at all)
- **Example**: "Agent offered callback at turn 8 before any appointment nudge was attempted (no nudge until turn 15, if at all)"

### `NO_APPOINTMENT_ATTEMPT_BEFORE_ROUTING` (WARNING)
- **When**: On vague routing calls, agent routed (transferred or scheduled callback) without attempting appointment nudge first
- **Applies to**: Vague routing calls only (not explicit dept routing or named person requests, where immediate transfer is correct)
- **Evidence**: Note that agent transferred/scheduled callback with no prior appointment nudge attempt
- **Example**: "Customer said 'can I have sales?' and agent immediately scheduled callback without first asking what they needed or offering appointment"

### `MISSING_INTENT_QUALIFICATION` (WARNING)
- **When**: Agent offered callback or transfer WITHOUT first asking what the customer needs
- **APPLIES TO (qualification required)**:
  - **Sales calls** (legitimate_sales): Customer may have a question agent can answer before callback/transfer
  - **Vague routing calls** (customer says "I need someone" without specifying dept): Agent should ask what they need
  - **Specific person requests** (customer asks for "John" or "the manager"): Agent should ask what the need is
- **DOES NOT APPLY (qualification NOT required)**:
  - **Explicit dept routing** (customer explicitly asks for "service", "parts", "finance" by name): Agent can transfer immediately without asking what the need is — the customer already qualified themselves
  - **Spam/wrong number calls**: N/A
- **Detection (IMPORTANT - Multi-step)**:
  1. Check call type from Step 0 classification
  2. If sales or vague routing: Scan transcript for agent asking intent-qualifying phrases **BEFORE** callback/transfer offer
  3. Qualifying phrases include: "What can I help you with?", "What are you interested in?", "What vehicle?", "What's your need?", "What brings you in?", "What can I do for you?", "Tell me about...", "How can I assist?", or similar
  4. If agent asked intent-qualifying question AND customer responded → do NOT flag (qualification was attempted)
  5. If agent DID NOT ask any qualifying question before offering callback/transfer → **FLAG**
  6. **IMPORTANT**: If customer insisted on transfer after agent asked "what do you need?", that is NOT a failure. Manual review explicitly praises this: "Agent did well by asking... agent's attempt did not work out, but agent did good here."
- **Examples of BAD qualification** (FLAG only if agent skipped asking):
  - Customer: "Can I have sales?" → Agent immediately schedules callback without asking anything → FLAG
  - Customer calls sales line → Agent immediately offers callback without asking vehicle/needs → FLAG
- **Examples of GOOD qualification** (do NOT flag even if transfer happens):
  - Customer: "Can I speak to someone?" → Agent: "Of course! What vehicle are you interested in?" → [customer still insists on transfer] → Agent transfers (this is good - agent asked)
  - Customer: "Service please" → Agent immediately transfers (no qualification needed; customer already specified dept)
  - Customer: "Can I talk to John?" → Agent: "I can help you or transfer you to John. What do you need?" → [customer insists] → Agent transfers (this is good - agent asked)
- **Evidence**: Quote customer's request + quote agent's response (if agent asked) + note when callback/transfer was offered
- **Example of FLAG**: "Customer asked 'Can I have sales?' at turn 3. Agent said 'I'll schedule a callback for you' at turn 4 without any qualifying question in between."
- **Example of NO FLAG**: "Customer asked 'Can I have sales?' at turn 3. Agent asked 'What vehicle are you interested in?' at turn 4. Customer insisted on sales at turn 5. Agent scheduled callback at turn 6." (agent did ask intent)
- **Score Impact**: WARNING; contributes to Score 2 (agent should have attempted to help) - but only if agent skipped the qualifying question entirely

### `BOOKED_UNAVAILABLE_VEHICLE` (WARNING)
- **When**: Agent booked appointment for a vehicle that tool showed as sold/unavailable
- **Evidence**: Tool result showed `"sold": true` or status unavailable; agent booked anyway without offering alternative
- **Example**: "Agent booked test drive for RDX that inventory search showed as sold"

### `ENGAGED_OUT_OF_SCOPE_TOPIC` (CRITICAL)
- **When**: Agent quoted specific rates, prices, discounts, warranty terms, trade-in values, lease terms, or other out-of-scope details instead of deflecting
- **Topics**: Financing rates/APR/payments/down payments; lease terms/residuals/mileage caps; trade-in valuations; price negotiation discounts; incentive/rebate amounts; CPO warranty specifics; post-sale operational answers (delivery, title, registration, post-sale paperwork)
- **Evidence**: Quote agent's statement that engaged with topic + specify which topic category
- **Example**: "Agent said 'I can probably get you down to 5.9% APR on a 60-month loan' instead of deferring to finance team." OR "Agent gave trade-in estimate: 'Your car is worth about $12,000'" OR "Agent confirmed warranty coverage specifics instead of deferring to sales team"

### `MISSED_DEFLECT_BRIDGE` (WARNING)
- **When**: Agent correctly deflected from an out-of-scope topic BUT went straight to callback/transfer without first attempting appointment bridge
- **Evidence**: Note the turn where deflection occurred and turn where callback/transfer was offered; confirm no appointment bridge attempt appeared between them
- **Example**: "At turn 5, customer asked about monthly payment. Agent said 'That's something our finance team handles.' At turn 6, agent offered 'I'll have someone call you back' without offering an appointment first."

### `NO_ALTERNATIVE_OFFERED` (WARNING)
- **When**: Agent confirmed customer's specific vehicle/trim is unavailable BUT did not ask about preferences or recommend an alternative vehicle
- **Applies to**: A.1 (trim not in stock) scenario
- **Evidence**: Inventory search showed 0 results for customer's specific request; agent made no follow-up recommendation attempt
- **Example**: "Customer asked for 2024 Altima SV in blue. Inventory search returned 0 results. Agent said 'I don't have that trim right now' and moved to other topics, never asking 'What are you looking for in a vehicle?' or offering an alternative."

---

## Output Format

```json
{
  "dimension": "lead_qualification_conversion",
  "score": 3,
  "reasoning": "Agent discovered intent (2015 Outlander Sport, tomorrow after 5 PM). Booked appointment with date and time confirmed. Warm sign-off with name usage.",
  "issues": []
}
```

If score 2 or 1:

```json
{
  "dimension": "lead_qualification_conversion",
  "score": 1,
  "reasoning": "Customer showed clear buying signal ('when can I come check it out?') and agent found exact vehicle, but never offered appointment. No booking attempt or callback offered.",
  "issues": [
    {
      "type": "MISSED_APPOINTMENT_OPPORTUNITY",
      "severity": "warning",
      "signals": ["specific_vehicle_interest", "timeline_mentioned"],
      "customer_quote": "when can I come check it out?",
      "turn": 8,
      "evidence": "Agent found 2024 Altima S in turn 12, had mileage/price confirmed, but never said 'would you like to schedule a test drive?' No sales_create_meeting called."
    }
  ]
}
```

---

## Special Cases

**N/A scenario**: If the call is purely informational (e.g., "what are your hours?") with no vehicle/appointment path explored, mark as N/A:

```json
{
  "dimension": "lead_qualification_conversion",
  "score": "N/A",
  "reasoning": "Call was informational only (operating hours inquiry). No vehicle discussion or appointment opportunity present."
}
```

**Escalation instead of booking**: If agent appropriately escalated the call to a human (e.g., financing question), that can count as score 3 if the escalation was clear. But only if the hand-off was complete with summary and next steps.

**Multiple vehicles**: If customer was looking at 3+ vehicles without clear preference, agent asking "which one interests you most?" is good qualification. Booking without narrowing down is score 2 (Partial).

**Callback not scheduled**: If agent promised "I'll call you back tomorrow" but never called `sales_create_meeting` to schedule it, that's a miss. Score likely 1 or 2 depending on context.

---

## Examples from Real Calls

**Call 2 (Score 3)**:
- Intent: "I see it on your website" → 2015 Outlander, specific
- Timeline: "Tomorrow after work" → explicit
- Qualification: Agent asked "What time works? 4:30 or 5 PM?" → adapting to constraints
- Booking: Called `sales_create_meeting` with date 2026-03-26, time 17:00, customerName: John
- Sign-off: "So you're all set for 5 PM tomorrow. Thanks for calling!"
- Result: ✅ Score 3. Full qualification + booking + warm close.

**Call 7 (Score 1)**:
- Intent: "I'm interested in the 2024 Altima S" → specific vehicle
- Timeline: "when can I come check it out?" → explicit timeline interest
- Qualification: None. Agent found vehicle, stated mileage, but asked no qualifying questions
- Booking: No `sales_create_meeting` called. No callback offered.
- Result: ❌ Score 1. Clear buying signal, zero conversion attempt.

**Call 5 (Score 1)**:
- Intent: "What's the price on this one?" → customer interested
- Qualification: None. Agent gave price, nothing more.
- Booking: No attempt. Call ended with "is there anything else?"
- Result: ❌ Score 1. Missed opportunity for follow-up or callback.

**Call 4 (Score 3)**:
- Intent: "I have a $7,800 budget" → clear budget signal
- Questions: Asked about vehicle type if needed. No wasted questions.
- Vehicles: Agent found 3 vehicles in budget
- Slots: Agent offered "Wednesday at 2 PM or Thursday at 10 AM?" (hard slots)
- Booking: Customer confirmed → appointment scheduled
- Result: ✅ Score 3. Efficient questioning, found matches, offered hard slots, booked with confirmed time.

**Example of Score 2 (Hard vs Soft Slots)**:
- Agent found vehicle, customer showed interest
- But agent said: "We're open Monday-Saturday, 9 AM to 7 PM. When works better for you?" (soft slot)
- Should have said: "We can get you in today at 3:30 PM or tomorrow at 10 AM. Which works better?" (hard slot)
- Result: ⚠️ Score 2. Found vehicle and pushed toward booking, but offered soft slots instead of hard options within 24h.

**Example of Score 2 (Question Efficiency)**:
- Agent: "Hi, this is Emily. What vehicle are you looking for?"
- Customer: "It's a Mercedes work van"
- Agent: "Got it. The Metris or Sprinter?"
- Customer: "Metris"
- Agent: "Are you looking to purchase or finance it?" ← UNNECESSARY QUESTION
- Should have been: Agent: "Yes, we've got a 2018 Mercedes Metris available at $13,491. Want to swing by today at 12 or tomorrow at 10 AM to test drive it?"
- The finance question didn't help move toward booking. It added a turn and delayed getting to appointment offer.
- Result: ⚠️ Score 2. Intent found, vehicle located, but wasted turn on non-essential question. Should have consolidated.

