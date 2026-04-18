# Sales Inbound Agent Evaluation Specification

> LLM-based conversation quality eval framework for Vini Sales Inbound Agents, with BARS (Behaviorally Anchored Rating Scales) rubrics grounded in real call data (62-call manual review with expert calibration).

---

## Overview

Each call is evaluated on **6 dimensions**, each scored **1-3** using BARS (Failure / Partial / Success). The output is:

1. **Per-dimension scores** (1-3 each, weighted)
2. **Overall score** (1-3 weighted average)
3. **Structured issue list** (typed, severity-tagged, evidence-backed)
4. **Capability gap aggregation** (batch-level patterns from recurring issues)

**Why 1-3 BARS?** Removes subjective ambiguity ("is this a 3 or a 4?"). Each score is defined by specific, observable agent behavior — not quality gradient.

---

## Latest Updates (Coverage Expansion Round)

### New Call Types & Use Cases Covered

**Expansion scope**: Added 38+ new use cases from 8 categories (A, B, C, D, E, H, L). Coverage increased from 5/76 (7%) to 43+/76 (57%).

#### 1. Out-of-Scope Topic Handling (`out_of_scope_topic` call type)
**File**: `eval-prompt-conversion.md`

Covers all deflect-and-bridge scenarios: finance questions (D.1–D.9), lease-end inquiries (E.1–E.6), trade-in valuations (C.1), price negotiation (A.4, B.4), incentives (A.5), warranty explanations (B.3), and operational post-sale questions (L.1–L.4, L.7).

**BARS**:
- **Score 3**: Agent deflects clearly ("That's something our finance team handles"), bridges to appointment with hard slots (two fixed times within 24h), OR offers callback/transfer to correct team with urgency framing.
- **Score 2**: Agent deflects correctly but skips appointment bridge and goes straight to callback, OR urgency framing missing.
- **Score 1**: Agent engages substantively (quotes rates, prices, valuations, warranty terms), OR says "I can't help" without offering bridge.

**New issue types**:
- `ENGAGED_OUT_OF_SCOPE_TOPIC` (CRITICAL) — agent quoted specific rates, prices, discounts, trade-in values, or warranty details
- `MISSED_DEFLECT_BRIDGE` (WARNING) — agent deflected but went straight to callback without attempting appointment bridge
- `NO_ALTERNATIVE_OFFERED` (WARNING) — vehicle unavailable but agent didn't ask preferences or recommend alternative

#### 2. Complaint Handling (`complaint_call` call type)
**File**: `eval-prompt-escalation.md`

Covers all complaint use cases (H.1–H.8): post-purchase dissatisfaction, delivery complaints, broken promises, F&I disputes, price discrepancies, mechanical issues, feature failures, and hostile/abusive callers.

**BARS**:
- **Score 3**: Agent responded with empathy IN THE SAME TURN complaint was raised ("I'm really sorry to hear that"), did NOT argue or minimize, transferred to correct department with complete summary, stayed calm with hostile callers.
- **Score 2**: Agent transferred correctly but no empathy before transfer, OR transferred to wrong department, OR summary incomplete.
- **Score 1**: Agent argued/dismissed complaint, defended dealership, or provided no escalation when complaint clearly required human involvement.

**New issue types**:
- `COMPLAINT_NO_EMPATHY` (WARNING) — agent processed complaint without acknowledging frustration before action
- `COMPLAINT_NOT_ESCALATED` (CRITICAL) — complaint raised but no transfer or escalation executed
- `HOSTILE_CALLER_MISHANDLED` (WARNING) — agent matched hostility, became defensive, or escalated tension

#### 3. Enhanced Objection Handling & Reframe Scenarios
**File**: `eval-prompt-conversion.md` (expanded Step 4)

**Out-of-stock reframe (A.1)**:
- ✅ Score 3: Agent states vehicle unavailable → asks about customer's must-have preferences → recommends alternative from inventory → drives to appointment with hard slots
- ❌ Score 1: Agent confirms unavailability and stops; no recommendation or preference exploration

**High-mileage reframe (B.6)**:
- ✅ Score 3: Agent acknowledges mileage → reframes with maintenance history (CarFax), brand reliability, or price-to-value → drives to appointment
- ❌ Score 1: Agent confirms high mileage, apologizes, expresses no confidence; no reframe or drive to appointment

**Negative equity / credit concern reframe (C.3)**:
- ✅ Score 3: Agent acknowledges concern empathetically → states dealership works with all credit/equity situations → bridges to appointment or finance team
- ❌ Score 1: Agent implies customer may not qualify, avoids the topic, or provides no reassurance or bridge

### Coverage Summary Table

| Category | Use Cases | Before | After | Added |
|---|---|---|---|---|
| A — New Vehicle | 9 | 1 | 3 | A.1, A.4, A.5 |
| B — Used Vehicle | 7 | 2 | 5 | B.3, B.4, B.6 |
| C — Trade-In | 7 | 0 | 2 | C.1, C.3 |
| D — Financing | 9 | 0 | 9 | D.1–D.9 |
| E — Lease-End | 6 | 0 | 6 | E.1–E.6 |
| H — Complaints | 8 | 0 | 8 | H.1–H.8 |
| L — Operational | 7 | 0 | 5 | L.1–L.4, L.7 |
| **Total** | **76** | **5 (7%)** | **43+ (57%)** | **+38** |

### Detection Changes

**Conversion Prompt**:
- **Step 0.5**: NEW — Scan for out-of-scope topic triggers across 8 categories (finance, lease, trade-in, price, incentives, warranty, operational, credit)
- **Step 1**: Updated — Added out-of-stock scenario as buying signal
- **Step 4**: Expanded — Added three reframe-and-drive sub-scenarios (out-of-stock, high-mileage, credit/equity)

**Escalation Prompt**:
- **Step 1.5**: NEW — Detect complaint calls via dissatisfaction language, emotional cues, broken promises, hostility
- **Detection**: Distinguishes between standard transfers and complaint escalations; applies empathy requirement to complaint calls only

### No New Tools Required
All changes use existing BARS scoring (1/2/3), issue flagging format, and detection logic. No new tool calls or parameters introduced.

---

## Call Type Classification (Step 0: Context Enrichment)

Before BARS dimensions are scored, each call is classified into one of six types. This classification informs which dimensions are scored and how BARS anchors apply.

### Call Types

- `**legitimate_sales**`: Customer has genuine vehicle buying intent. Examples: "I was looking at the 2022 Honda Passport online", "Do you have any used SUVs in stock?"
  - All 6 dimensions scored normally.

- `**routing_or_transfer**`: Customer explicitly asks for another department or specific person. Examples: "Service department", "Parts please", "Can I speak to Lance?"
  - Conversion scored on engagement attempt + callback handling (see revised BARS below).
  - Escalation dimension still scored.
  - Other dimensions score normally.

- `**sales_agent_conversion_attempt**`: Customer is already on sales agent, asking for "sales" or "a real person" — this is a conversion opportunity, not a transfer. Examples: "Can I have sales?", "I need to speak to a real person"
  - Conversion scored on agent's ability to recognize and redirect (see revised BARS below).
  - Escalation is N/A (no explicit escalation intended).
  - Other dimensions score normally.

- `**out_of_scope_topic**` **(NEW)**: Customer raises topic agent should NOT engage with substantively: financing (rates, payments, APR), lease-end, trade-in valuation, price negotiation, incentives/rebates, warranty, or operational post-sale. Examples: "What's my monthly payment?", "What's my car worth for trade-in?", "Can you match this price?", "How much is the warranty?"
  - Conversion scored on deflect-and-bridge behavior (see BARS in Conversion dimension below).
  - Other dimensions score normally if vehicle search also occurred.
  - **Key rule**: Agent must NEVER quote specific rates, prices, discounts, trade-in values, or warranty terms. Must bridge to appointment or escalate to correct team.

- `**complaint_call**` **(NEW)**: Customer raises post-purchase dissatisfaction, delivery complaint, broken promise, F&I dispute, price discrepancy, mechanical issue, feature failure, or hostile/abusive behavior. Examples: "The car you sold me broke down after two days", "You promised [feature] and it's not there", "I'm going to call an attorney", aggressive/hostile tone.
  - Escalation scored on empathy acknowledgment + correct department routing (see BARS in Escalation dimension below).
  - Other dimensions score normally if applicable.
  - **Key rule**: Agent MUST respond with empathy IN THE SAME TURN complaint is raised, then escalate to correct human department without arguing or minimizing.

- `**non_dealer**`: Spam, wrong number, vendor call, employment verification, internal routing. Examples: "Is this a Lexus dealer?", employment verification calls, "[Company] calling about invoice verification"
  - All dimensions are N/A. No scoring applied.

---

## Rubric Dimensions (1-3 Scale, Weighted)

### 1. Information Accuracy (Weight: 20%)

**What it measures**: When the agent states ANY fact that came from a tool result or system context, does it match the source exactly? This includes vehicle details, hours, financing, appointment confirmations, transfer status, and all other factual claims.

**Critical rule**: Match agent statement to the *specific data point in the tool result or context* — verify the source of every factual claim the agent makes.

#### Score 3 (Success)

ALL factual claims by agent match tool results or system context exactly:

- **Vehicle Details**: Price, mileage, condition, year, make, model, trim all match tool result. No contradictions. Minor rounding OK (e.g., "about 30,000 miles" vs "30,778 miles").
- **Dealership Hours**: Agent stated "we're open until 6pm" or "closed tomorrow" matches `dealership_check_hours` tool result OR ContextData.Dealership.Hours. Time conversions correct (morning→9am, afternoon→2pm).
- **Financing Availability**: Agent said "we offer leasing" and tool returned `lease: true`. Agent said "loan options available" and tool returned `loan: true`. No false positives.
- **Appointment/Callback Confirmations**: Agent told customer "your appointment is scheduled for Tuesday at 3pm" and `sales_create_meeting` returned confirmed time matching that.
- **Transfer Availability**: Agent said "service department is available" and tool returned `status: OPEN`. Agent said "finance is closed, I'll schedule a callback" and tool returned `status: DEPARTMENT_CLOSED`.
- **Other Tool Data**: Any data from `inventory_get_carfax_history`, `sales_get_finance_partners`, or `communication_send_sms` matches the tool result accurately.

#### Score 2 (Partial)

Mostly accurate, but one error on a non-critical fact:

- **Vehicle Details**: All core fields correct (price, mileage, condition, year/make/model), but agent misstated trim, interior color, or a feature that didn't affect the buying decision.
- **Hours/Financing/Confirmations**: Agent misstated hours (said 5pm when it's 6pm), or mentioned a financing option that wasn't confirmed by tool result but corrected it later OR the error didn't affect decision-making.
- **Appointment Details**: Agent confirmed "Tuesday at 3pm" but tool result showed "Tuesday at 2:30pm" — close but not exact. Customer didn't catch the discrepancy.

#### Score 1 (Failure)

Major contradiction between agent's claim and tool result:

- **Vehicle Details**: Agent stated price, mileage, condition, year, or make/model that directly contradicts the tool result for that vehicle.
- **Hours/Availability**: Agent said "we're open until 6pm" but tool showed closed. Agent said "finance department is available now" but tool returned `DEPARTMENT_CLOSED`.
- **Financing**: Agent said "we offer leasing" but tool returned `lease: false`. Agent invented lender names or options not in tool result.
- **Appointment/Callback**: Agent told customer "I've scheduled your appointment for Tuesday at 3pm" but `sales_create_meeting` returned "Tuesday at 2:00pm" or never returned success. Agent promised callback but never scheduled via tool.
- **Hallucinated/Wrong Vehicle**: Agent matched wrong vehicle's data to customer's inquiry. Agent invented specs with zero tool support or context data.

**Real-world anchors**:

- Call 2 (Score 3): Agent correctly stated "2015 Mitsubishi Outlander Sport" and "$4,995" — exact vehicle match. Hours stated correctly against ContextData.
- Call 7 (Score 3 after correction): Agent stated "161,878 miles" for BMW X3 2004 — correct per tool result, not hallucination as initially audited.
- Call 1 (Score 1): Agent promised callback but tool `sales_create_meeting` never returned success. Hours discrepancy: agent said "open until 6pm" but tool showed closed at that time.

---

### 2. Lead Qualification & Conversion (Weight: 20%)

**What it measures**: Did agent discover customer intent, properly qualify the lead, and move toward an appointment or next step? Scoring varies by call type.

**Key behavioral signals**: Budget, vehicle interest, timeline, when customer would visit.

#### For `legitimate_sales` Calls

##### Score 3 (Success)

Agent identified customer intent (vehicle, timeline, budget). Asked qualifying questions if intent was unclear. Handled at least one objection. Booked appointment with confirmed date and time via `sales_create_meeting` with all details (date, time, vehicle, phone). OR escalated appropriately with clear next steps. Customer left knowing what happens next. Call ended with warm sign-off (agent thanked customer, used their name if known).

##### Score 2 (Partial)

Agent identified intent and made an attempt to book. BUT: did not ask qualifying questions to narrow down vehicle fit, OR did not push past first objection, OR did not confirm both date AND time explicitly before booking, OR booked for a vehicle the tool showed as sold/unavailable without offering an alternative. Customer had continued interest but call ended without confirmed appointment.

##### Score 1 (Failure)

Customer showed a clear buying signal (named specific vehicle, stated timeline, budget confirmation, or explicitly asked "when can I come check it out?") AND agent never attempted to book an appointment or offer a callback. Call ended with no next steps or half-hearted follow-up ("is there anything else I can help with?"). Or agent booked appointment without first confirming vehicle availability via search.

#### For `routing_or_transfer` Calls

(Customer explicitly asked for another department or specific person)

##### Score 3 (Success)

Customer asked for another dept/person. Agent made ONE genuine attempt to understand what the customer needed and whether the sales agent could help first. If dept was OPEN: Transfer executed with complete summary (customer name, vehicle of interest if applicable, reason for transfer). If dept was CLOSED (tool returned `DEPARTMENT_CLOSED`): Agent immediately offered callback via `sales_create_meeting` with `intent: "request_callback"`. Did NOT abandon. Warm sign-off acknowledging the situation.

##### Score 2 (Partial)

Agent transferred correctly but made no engagement attempt first (skipped "what do you need?" step). OR engagement attempt was formulaic with no real attempt to understand ("I can only help with sales, I'm afraid"). OR dept closed and agent offered callback but never formally scheduled it via `sales_create_meeting`.

##### Score 1 (Failure)

Agent transferred immediately on turn 1 with zero engagement attempt. OR dept returned `DEPARTMENT_CLOSED` and agent attempted transfer anyway (ignored tool guidance). OR dept closed and agent offered nothing (no callback, no next steps). OR agent promised callback but never called `sales_create_meeting` to schedule.

#### For `sales_agent_conversion_attempt` Calls

(Customer already on sales agent, asking to be transferred "to sales" or "to a real person")

##### Score 3 (Success)

Agent recognized THIS IS A CONVERSION OPPORTUNITY. Did NOT immediately transfer to "sales" (they're already connected). Instead, agent asked what customer needed and attempted to help directly. Customer's need was addressed (answer given, appointment booked, or clarification made). Warm sign-off.

##### Score 2 (Partial)

Agent acknowledged they are the sales agent but pivoted awkwardly into sales pitch or didn't engage genuinely. Agent explained their limitations but offered some help ("I can search inventory, let me find..."). Failed to redirect the conversation successfully, but didn't immediately abandon.

##### Score 1 (Failure)

Agent attempted to transfer customer to "sales" when customer is ALREADY on the sales agent (routing error). OR agent said "I can't help you" or "I'm not able to assist" with zero engagement attempt. OR agent blamed customer ("you've reached the wrong department") without trying to help.

**Real-world anchors**:

- Call 2 (Score 3, legitimate_sales): Customer said "I see it on your website" (intent) + "tomorrow after work" (timeline). Agent booked 5 PM, rescheduled per preference, warm close with name usage.
- Call 7 (Score 1, legitimate_sales): Agent found exact vehicle, customer asked "when can I come check it out?" (buying signal), but never offered appointment or asked qualifying questions. Missed sale.
- Call 5 (Score 1, legitimate_sales): Customer asked for price, got answer, no callback or appointment attempt. No next steps.
- Call 3 (Score 3, routing_or_transfer): Customer asked for service department. Agent probed briefly ("what's the issue?"), learned about post-purchase service need. Dept closed (tool returned DEPARTMENT_CLOSED). Agent offered callback for Monday. Scheduled via sales_create_meeting.

**N/A condition**: If call is purely informational (e.g. "when are you open?") with no inventory/appointment/transfer path explored, Conversion is N/A.

---

### 3. Escalation & Transfer Handling (Weight: 15%)

**What it measures**: When a transfer or callback was needed, was it triggered at the right time with accurate context?

#### Score 3 (Success)

Transfer or callback was clearly warranted (customer explicitly asked for human, frustration evident, topic exceeded agent scope, system limitation hit, or tool returned explicit error guidance). Agent: (a) spoke hold message aloud before transferring, (b) included complete summary (customer name, vehicle of interest, reason for call), (c) handled tool error status correctly per guidance (DEPARTMENT_CLOSED → offered callback; TRANSFER_FAILED → apologized, offered callback), (d) did not put customer name in the `name` field of transfer tool (that field is for destination staff, not customer). Tool returned success.

#### Score 2 (Partial)

Transfer or callback was executed, but: summary was vague or incomplete (missing vehicle, intent, or customer name), OR transfer was slightly premature (one more engagement attempt could have resolved it), OR hold message was missing, OR tool returned failure and agent did not re-attempt or escalate to live transfer when available.

#### Score 1 (Failure)

Tool returned DEPARTMENT_CLOSED or TRANSFER_FAILED and agent ignored explicit guidance and retried transfer anyway (or abandoned customer). OR agent promised callback but never called `sales_create_meeting`. OR transfer executed with no summary at all. OR agent transferred on first customer objection without attempting engagement. OR agent put customer's personal name in the `name` field (transfer tool misuse).

**Real-world anchors**:

- Call 3 (Score 3): Post-purchase service issue — appropriate escalation, empathetic, clear Monday callback.
- Call 1 (Score 1): Tool returned DEPARTMENT_CLOSED with guidance to offer callback. Agent transferred anyway. Later promised callback but never scheduled it.
- Call 6 (Score 2): Booking succeeded but for a sold vehicle; should have verified availability first.

**N/A condition**: If no transfer or callback occurred AND no trigger was present (call resolved without escalation need), Escalation is N/A.

---

### 4. Conversation Quality (Weight: 15%)

**What it measures**: Tone, engagement, personalization, and adaptive communication — did agent make the customer feel heard?

#### Score 3 (Success)

Tone was natural and warm. Agent referenced customer's specific constraints or preferences, demonstrating active listening (e.g., "You mentioned traffic — how about 5 PM instead?"). Customer's name used at least once naturally. Multilingual support provided when customer code-switched. Clear, natural pacing — no overly long monologues. Call ended with warm sign-off: thanked customer, confirmed next steps if applicable.

#### Score 2 (Partial)

Professional and adequate, but transactional. Agent completed the task without personalization. Name not used. No visible adaptation to customer's emotional state, interruptions, or stated constraints. Long unprompted monologues (listing 5 vehicles + prices at once; sharing all department hours in one turn before asking what customer needs). Customer was helped but did not feel particularly heard.

#### Score 1 (Failure)

Agent was repetitive (repeated identical question when customer was silent instead of using a different prompt or asking "are you still there?"). Stuck in loop or contradicted self repeatedly. Used unclear language. Customer expressed frustration or confusion. Agent missed clear emotional cues (distress, hesitation, repeated objections) without adjusting approach. Call ended abruptly without thank you or next steps confirmation.

**Real-world anchors**:

- Call 8 (Score 3): Used customer name "Josh" naturally. Proactive confirmation. Warm close.
- Call 2 (Score 3): Active listening — "You mentioned traffic" → rescheduled per preference. Bilingual support.
- Call 1 (Score 1): Repeated "Is that number ending in 4 4 1 1 still good?" 6 times when customer silent. Clear system failure.
- Call 4 (Score 2): Found vehicles and pushed for appointment, but delivered as long monologue — should have asked needs first.

---

### 6. Response Latency (Weight: 10%)

**What it measures**: How quickly does the agent respond to the customer within a single turn, and are there gaps of silence from the customer side (dead air)?

**Timing Metrics**:

- **Agent Response Latency** (per turn): time from end of customer message to start of agent response (milliseconds). Formula: `bot_msg.time - preceding_user_msg.endTime`.
- **Dead Air** (customer side): gaps of silence where customer is waiting. Formula: `next_user_msg.time - preceding_bot_msg.endTime`.

#### Score 3 (Success)

Median agent response latency ≤ 3000ms (3 seconds). No single turn exceeds 6000ms (6 seconds). Dead air gaps within acceptable range (no gaps > 12000ms).

#### Score 2 (Partial)

Median agent response latency 3001–5000ms (3–5 seconds). OR 1–2 individual turns exceed 6000ms but most responses are brisk. OR one dead air gap exceeds 12000ms but rest of call is responsive.

#### Score 1 (Failure)

Median agent response latency > 5000ms (5 seconds) throughout the call. OR 3+ turns exceed 6000ms latency. OR multiple dead air gaps > 12000ms indicating system lag or customer waiting frustration.

**N/A condition**: Calls without timestamp data (old format logs) are scored N/A. This dimension is only evaluated for calls with `time` and `endTime` fields on each message.

**Issues to Flag**:

- `HIGH_LATENCY_TURN` (WARNING): Single turn latency > 6000ms. Include turn number + milliseconds.
- `EXCESSIVE_DEAD_AIR` (WARNING): Single dead air gap > 12000ms. Include turn number + milliseconds.

**Real-world anchors**:

- Score 3: Agent responds within 2–3 seconds to each customer message. Customer never waits more than 12 seconds between responses.
- Score 2: Occasional 7–8 second response delay (e.g., during tool invocation), but most responses brisk. One notable dead air gap but not repeated.
- Score 1: Consistent 8–10 second or longer response delays on most turns. Customer waiting 15–20+ seconds repeatedly, signaling system or tool latency issues.

---

## Tool Accuracy Axes (1-3 Scale, Per-Tool)

**Aggregates to Tool Accuracy dimension (20% weight).**

Each tool invocation is scored 1/2/3. Multiple invocations in one call aggregate as:

- **3 (Success)**: All invocations scored 3. No missed tool calls.
- **2 (Partial)**: All invocations scored 2 or 3 (none scored 1). OR one missed tool call of WARNING severity.
- **1 (Failure)**: Any invocation scored 1. OR any missed tool call of CRITICAL severity. OR IGNORED_TOOL_GUIDANCE present.

**N/A tools**: Tools not invoked and not needed are excluded from the dimension score.

---

### `inventory_search_vehicles_v3`

#### Score 3 (Success)

Customer asked about inventory. Agent extracted params from utterance (make, model, year, budget, condition) — no values added that customer didn't state. Called tool. Relayed results accurately: stated "new" or "pre-owned", correct year/make/model/trim/price for each vehicle. For ambiguous VIN/stock input (e.g., customer said "stock number or VIN, I'm not sure"), agent passed SAME value to both `vin` AND `stock` fields. Did not call repeatedly for the same query without broadening filters.

#### Score 2 (Partial)

Tool called with valid params, but: agent misrepresented one result field (wrong trim, incorrect mileage round, wrong price stated), OR called the tool 3+ times in succession for the same query without expanding search criteria, OR passed price buffer ("around 30K" → `[27000, 33000]`) when tool rules require exact customer values, OR failed to include price range in first search when customer mentioned budget (requiring extra search).

#### Score 1 (Failure)

Agent answered inventory question without calling the tool (invented vehicle details). OR violated ABSOLUTE IDENTIFIER rule (customer gave VIN/stock but agent added make/model/year filters in the same call). OR misinterpreted param type from customer utterance (e.g., interpreted stated price as stock number, fetched wrong vehicle). OR extracted param from wrong vehicle (customer mentioned two vehicles, agent called search for wrong one).

---

### `inventory_get_carfax_history`

#### Score 3 (Success)

Customer asked about history, accidents, or previous owners on a used vehicle. Agent called tool with correct full 17-char VIN from prior tool result. Relayed ownership count first, accident history only when asked, service history concisely. Used natural language for dates ("February 2015" not "02-15-2015") and mileage ("about 22,000 miles" not "22047"). Did not call tool a second time for the same VIN in the same call.

#### Score 2 (Partial)

Called with correct VIN, but violated output format (read VIN digits aloud character-by-character, gave dates in raw format, read exact odometer digits instead of rounding). OR agent called this tool for a new vehicle (should have said "new vehicles have no accident history" without calling).

#### Score 1 (Failure)

Customer asked about vehicle history on a used vehicle, agent answered without calling tool. OR agent called it twice for the same VIN in the same call. OR agent shared CarFax details via SMS/email when policy only allows verbal or in-person disclosure.

---

### `dealership_check_hours`

**Note**: This tool is NOT needed before transfer calls. The `communication_transfer_call_v3` tool checks hours internally. Use this tool only for customer queries about specific date/time availability.

#### Score 3 (Success)

Customer asked about specific date/time availability (not general hours). Agent called tool with: correct YYYY-MM-DD date, HH:mm time (correctly converting "morning"→"09:00", "afternoon"→"14:00", "evening"→"17:00"), correct department ("sales" default). Did not call for general "what are your hours?" queries (uses ContextData.Dealership.Hours instead).

#### Score 2 (Partial)

Called for general hours inquiry when ContextData should have been used. OR called with approximate but incorrect time conversion. OR called the same date/time/department a second time when result was already known.

#### Score 1 (Failure)

Customer asked "are you open [specific day/time]?" and agent answered from memory without calling tool. OR agent called with wrong date format (not YYYY-MM-DD). OR agent called but ignored tool result and stated different hours.

---

### `communication_transfer_call_v3`

**Important**: This tool checks department hours internally. Agent does NOT need to call `dealership_check_hours` first. If department is closed, tool returns `status: "DEPARTMENT_CLOSED"` with guidance "offer callback instead." **CRITICAL RULE**: If tool returns DEPARTMENT_CLOSED, agent MUST NOT attempt transfer. Agent must immediately pivot to callback via `sales_create_meeting` with `intent: "request_callback"`.

#### Score 3 (Success)

Transfer was warranted (customer explicitly asked for human, frustration evident, scope exceeded). Agent: (a) spoke hold message aloud before or during tool call, (b) included complete summary (customer name, vehicle of interest, reason), (c) did NOT put customer name in the `name` field (that field is for destination staff only), (d) handled error status correctly:

- DEPARTMENT_CLOSED → Agent immediately offered callback (NOT transfer) and called `sales_create_meeting` with `intent: "request_callback"` ✅
- TRANSFER_FAILED → Agent apologized and offered/scheduled callback ✅
- AMBIGUOUS → Agent read options to customer ✅
Tool returned success OR error was handled per guidance above.

#### Score 2 (Partial)

Transfer was appropriate but: summary was vague/incomplete (missing vehicle, intent, or customer name), OR transfer slightly premature (one more engagement attempt could have resolved it), OR hold message missing, OR tool returned DEPARTMENT_CLOSED and agent offered callback but never formally scheduled it via `sales_create_meeting`.

#### Score 1 (Failure)

**CRITICAL**: Tool returned DEPARTMENT_CLOSED and agent attempted transfer anyway (ignored guidance). **CRITICAL**: Tool returned DEPARTMENT_CLOSED and agent never scheduled callback via `sales_create_meeting`. Agent put customer's name in the `name` field. Agent transferred without hold message or summary. Agent transferred on first objection without attempting engagement first. Tool returned TRANSFER_FAILED and agent did not offer/schedule callback.

---

### `sales_create_meeting`

#### Score 3 (Success)

Customer confirmed both date AND time in conversation before tool was called. Tool called with: correct `intent` matching what customer discussed ("test_drive" not "consultation" when customer said test drive), `meetingStartTime` in ISO 8601, `customerPhone` in E.164 format, all VINs discussed in `dealerVins`, `customerName` if stated in conversation. If tool returned success, agent confirmed appointment details to customer.

#### Score 2 (Partial)

Meeting created but: VIN omitted when vehicle was discussed, OR `intent` mismatch ("schedule_appointment" when customer explicitly said "test drive"), OR `customerName` missing when provided in call, OR time confirmed but date wasn't explicitly confirmed (agent assumed "tomorrow"), OR agent did not confirm appointment details after successful creation.

#### Score 1 (Failure)

Customer confirmed appointment (stated date + time + agreed to come) but no `sales_create_meeting` was ever called. OR meeting created without confirmed date/time (agent invented values). OR `customerPhone` missing when available. OR agent promised callback but called with wrong intent. OR tool returned failure and agent did not re-attempt or escalate to live transfer.

---

### `communication_send_sms`

#### Score 3 (Success)

Customer explicitly asked to receive address via TEXT/SMS. Agent first read address aloud, then asked "Would you like me to text that to you?" and customer confirmed yes. Called tool with `messageType: "address"` and correct E.164 phone. Only called once per call.

#### Score 2 (Partial)

Agent called without explicitly asking permission first (skipped "Would you like me to text that?" step). OR attempted second SMS in same call after one already succeeded.

#### Score 1 (Failure)

Agent sent SMS without first reading address aloud (procedure violation). OR texted address when customer only asked to hear it (didn't request text). OR used wrong messageType or sent non-address content.

---

### `sales_get_finance_partners`

#### Score 3 (Success)

Customer asked about financing, loan, lease, or specific lender. Agent called tool. In response, only mentioned financing types that returned as `true` in `financeOptions`. If `lease: false`, agent never mentioned lease as option. Accurately relayed available partners if asked.

#### Score 2 (Partial)

Tool called correctly, but agent mentioned financing type not confirmed by result (e.g., "we offer leasing" when tool showed `lease: false`). OR agent failed to answer lender question even though tool result contained answer.

#### Score 1 (Failure)

Customer asked about financing options, agent answered without calling tool (invented lender names or assumed availability). OR agent mentioned financing options that contradict tool result.

---

## Overall Score Calculation

```
Overall = (Info Accuracy × 0.20) + (Conversion × 0.20) + (Tool Accuracy × 0.20) + (Escalation × 0.15) + (Conversation × 0.15) + (Response Latency × 0.10)
```

All dimensions are on 1-3 scale. Overall score is 1.0 to 3.0.

**Handling N/A dimensions**: When a dimension is N/A (not applicable to the call type or call context), that dimension is excluded from the weighted average. Renormalize by dividing the sum of applicable dimension scores by the sum of applicable weights.

**Example 1 (all dimensions apply)**:

- Information Accuracy: 3
- Conversion: 2
- Tool Accuracy: 3
- Escalation: 3
- Conversation: 2
- Response Latency: 3 (new format call with timestamps)

Overall = (3×0.20) + (2×0.20) + (3×0.20) + (3×0.15) + (2×0.15) + (3×0.10) = 0.60 + 0.40 + 0.60 + 0.45 + 0.30 + 0.30 = **2.65/3.0**

**Example 2 (Escalation N/A, Response Latency N/A)**:

- Information Accuracy: 3
- Conversion: 2
- Tool Accuracy: 3
- Escalation: N/A (no transfer trigger)
- Conversation: 2
- Response Latency: N/A (old format, no timestamps)

Applicable weights: 0.20 + 0.20 + 0.20 + 0.15 = 0.75
Renormalized weights: Info 0.267, Conversion 0.267, Tool 0.267, Conversation 0.200
Overall = (3×0.267) + (2×0.267) + (3×0.267) + (2×0.200) = 0.80 + 0.53 + 0.80 + 0.40 = **2.53/3.0**

---

## Issue Taxonomy

Issues are detected per call and tagged by type, severity, and evidence. Each issue references a specific turn number (message index) or tool call ID.

### A. Information Quality Issues

#### `WRONG_VEHICLE_INFO`

- **Severity**: WARNING
- **When triggered**: Agent stated a vehicle detail (price, mileage, condition, year, make, model, trim) that contradicts the tool result for that specific vehicle
- **Detection**: Match agent utterance to the vehicle being described, compare to that vehicle's tool result
- **Example**: Agent stated "32,000 miles" (correct per tool) for Vehicle A, then later said "162,000 miles" for Vehicle B but you verify it was also Vehicle A — contradiction
- **Evidence format**: `{ "issue": "WRONG_VEHICLE_INFO", "vehicle": "2024 Altima S", "field": "mileage", "agent_stated": "162,000 miles", "tool_result": "32,000 miles", "turn_number": 22 }`

#### `HALLUCINATED_DATA`

- **Severity**: WARNING
- **When triggered**: Agent stated details (price, feature, color, availability) with no support from tool result or context data
- **Detection**: Search transcript for agent claim, verify against tool results + system prompt context. If absent in both, hallucination.
- **Example**: Agent says "We have a blue 2024 Accord" but tool results show no blue Accords available
- **Evidence format**: `{ "issue": "HALLUCINATED_DATA", "agent_claim": "we have a blue 2024 Accord", "turn_number": 15 }`

---

### B. Tool Execution Issues

#### `WRONG_TOOL_PARAMS`

- **Severity**: WARNING
- **When triggered**: Tool parameters violate documented rules
- **Detection Examples**:
  - `inventory_search`: customer said ambiguous identifier (could be VIN or stock), agent only filled one field instead of both
  - Agent passed price buffer when rules require exact values
  - Param extracted from wrong vehicle (customer mentioned two, agent called search for wrong one)
  - Param type misinterpreted (customer said price, agent passed as stock number)
- **Evidence format**: `{ "issue": "WRONG_TOOL_PARAMS", "tool": "inventory_search_vehicles_v3", "param": "vin/stock", "expected": "both filled for ambiguous input", "actual": "only stock filled", "turn_number": 8 }`

#### `IGNORED_TOOL_GUIDANCE`

- **Severity**: CRITICAL
- **When triggered**: Tool result explicitly returned error status or instruction, agent did not follow it
- **Detection**: Check tool result for `status`, `message`, or explicit guidance fields
- **Example**: Tool returned `status: "DEPARTMENT_CLOSED"` + message: "Offer callback instead." Agent called transfer_call_v3 anyway.
- **Evidence format**: `{ "issue": "IGNORED_TOOL_GUIDANCE", "tool": "communication_transfer_call_v3", "guidance": "DEPARTMENT_CLOSED — offer callback instead", "agent_action": "attempted transfer", "turn_number": 16 }`

#### `MISSED_TOOL_CALL`

- **Severity**: WARNING or CRITICAL (context-dependent)
- **When triggered**: Agent should have called a tool but didn't
- **Heuristics**:
  - Customer asked for appointment → no `sales_create_meeting` (CRITICAL)
  - Customer asked for callback → no `sales_create_meeting` (CRITICAL)
  - Customer asked "are you open [time]?" → no `dealership_check_hours` (WARNING)
  - Customer asked for vehicle history → no `inventory_get_carfax_history` on used vehicle (WARNING)
  - Customer explicitly requested address via SMS → no `communication_send_sms` (CRITICAL)
- **Example**: Agent promised "I can set up a callback for Monday" but never called `sales_create_meeting`
- **Evidence format**: `{ "issue": "MISSED_TOOL_CALL", "tool": "sales_create_meeting", "context": "customer asked for callback after failed transfer", "turn_number": 18, "severity": "critical" }`

---

### C. Conversion & Lead Issues

#### `MISSED_APPOINTMENT_OPPORTUNITY`

- **Severity**: WARNING
- **When triggered**: Customer showed clear buying signals (specific vehicle + timeline mentioned, budget stated, or explicit availability question) AND agent never offered or attempted to book appointment
- **Detection**: Scan for:
  - Customer mentions specific vehicle name AND
  - Customer mentions when they can visit OR explicitly asks "when can I come check it out?" OR
  - Customer confirms vehicle details match their need
  - AND no `sales_create_meeting` was called
- **Example**: Customer said "when can I come check it out?" Agent found exact vehicle but never asked to book.
- **Evidence format**: `{ "issue": "MISSED_APPOINTMENT_OPPORTUNITY", "signals": ["specific_vehicle_interest", "timeline_mentioned"], "customer_quote": "when can I come check it out?", "turn_number": 8 }`

#### `BOOKED_UNAVAILABLE_VEHICLE`

- **Severity**: WARNING
- **When triggered**: Agent booked appointment for a vehicle that tool showed as sold/unavailable, without first confirming availability or offering alternate
- **Example**: Agent booked RDX test drive without checking if that specific RDX was still in inventory
- **Evidence format**: `{ "issue": "BOOKED_UNAVAILABLE_VEHICLE", "vehicle": "2024 RDX Premium", "status_from_tool": "sold", "turn_number": 15 }`

---

### D. Call Handling Issues

#### `INCOMPLETE_TRANSFER_SUMMARY`

- **Severity**: WARNING
- **When triggered**: Transfer/callback executed but summary was vague or missing key context
- **Detection**: Check tool call parameters. If summary <20 chars or missing vehicle/intent/customer name, flag it.
- **Evidence format**: `{ "issue": "INCOMPLETE_TRANSFER_SUMMARY", "tool": "communication_transfer_call_v3", "summary_provided": "customer wants information", "missing": ["vehicle_of_interest", "budget"], "turn_number": 12 }`

#### `DROPPED_CONTEXT`

- **Severity**: WARNING
- **When triggered**: Agent contradicts or forgets information established earlier in same call
- **Detection**: Scan for:
  - Agent earlier said "2024 Altima S" → later describes different vehicle properties
  - Agent established price range → later suggests vehicle outside range
  - Agent confirmed customer name → later uses different name
- **Example**: Agent correctly stated "32,000 miles" (turn 10) → later stated "162,000 miles" (turn 22) for same vehicle
- **Evidence format**: `{ "issue": "DROPPED_CONTEXT", "context": "vehicle_mileage", "established": "32,000 miles (turn 10)", "contradicted": "162,000 miles (turn 22)" }`

---

## JSON Output Schema

### Per-Call Eval Output

```json
{
  "call_id": "019d5b07-829e-7000-85b4-d6065f60abfa",
  "call_date": "2026-03-25T14:30:00Z",
  "eval_timestamp": "2026-04-08T10:15:00Z",
  "scores": {
    "information_accuracy": {
      "score": 3,
      "reasoning": "All vehicle details stated by agent matched tool results. Price, mileage, and trim were accurate."
    },
    "lead_qualification_conversion": {
      "score": 2,
      "reasoning": "Agent identified intent and booked appointment, but did not ask qualifying questions about customer preferences."
    },
    "tool_accuracy": {
      "score": 3,
      "tool_details": [
        {
          "tool": "inventory_search_vehicles_v3",
          "invocations": 1,
          "score": 3,
          "reasoning": "Customer stated budget. Agent extracted correctly, found vehicles, relayed accurately."
        },
        {
          "tool": "sales_create_meeting",
          "invocations": 1,
          "score": 3,
          "reasoning": "Customer confirmed date and time. Appointment created with all details."
        }
      ],
      "reasoning": "All tool invocations scored 3. No missed calls."
    },
    "escalation_transfer_handling": {
      "score": "N/A",
      "reasoning": "No transfer or callback needed. Not applicable to this call."
    },
    "conversation_quality": {
      "score": 3,
      "reasoning": "Natural tone. Agent used customer name. Warm sign-off with confirmation of next steps."
    },
    "overall_score": 2.85,
    "calculation": "(3×0.25) + (2×0.25) + (3×0.20) + (3×0.15) = 0.75 + 0.50 + 0.60 + 0.45 = 2.85/3.0"
  },
  "issues": [
    {
      "type": "MISSED_APPOINTMENT_OPPORTUNITY",
      "severity": "warning",
      "tool": "N/A",
      "context": "Customer mentioned timeline but agent did not push for appointment booking",
      "turn_number": 12,
      "evidence": "Customer said 'tomorrow afternoon' but agent only offered to send SMS with address, no booking attempt"
    }
  ],
  "summary": {
    "total_issues": 1,
    "critical_count": 0,
    "warning_count": 1,
    "recommendation": "PASS — Solid call with one missed opportunity. Agent demonstrated good information accuracy and booking execution despite skipping qualification step."
  }
}
```

### Batch Aggregation Output (Daily/Weekly)

```json
{
  "batch_id": "daily_2026-04-08",
  "period": "2026-04-08",
  "calls_evaluated": 11,
  "overall_stats": {
    "average_score": 2.45,
    "median_score": 2.5,
    "score_distribution": {
      "1.0-1.5": 2,
      "1.6-2.0": 3,
      "2.1-2.5": 4,
      "2.6-3.0": 2
    },
    "conversion_rate": 0.64,
    "tool_accuracy_breakdown": {
      "inventory_search_vehicles_v3": { "avg_score": 2.8, "invocations": 21 },
      "sales_create_meeting": { "avg_score": 2.2, "invocations": 9 },
      "communication_transfer_call_v3": { "avg_score": 2.0, "invocations": 3 }
    }
  },
  "issue_summary": {
    "MISSED_APPOINTMENT_OPPORTUNITY": {
      "count": 2,
      "affected_calls": ["Call 5", "Call 7"],
      "severity": "warning"
    },
    "WRONG_TOOL_PARAMS": {
      "count": 1,
      "affected_calls": ["Call 2"],
      "severity": "warning"
    },
    "IGNORED_TOOL_GUIDANCE": {
      "count": 1,
      "affected_calls": ["Call 1"],
      "severity": "critical"
    },
    "BOOKED_UNAVAILABLE_VEHICLE": {
      "count": 1,
      "affected_calls": ["Call 6"],
      "severity": "warning"
    }
  },
  "capability_gaps": [
    {
      "type": "agent_behavior",
      "pattern": "Agents fail to ask qualifying questions before attempting appointment booking. Leads to mismatched vehicle expectations.",
      "affected_calls": 3,
      "example_calls": ["Call 5", "Call 7", "Call 10"],
      "recommendation": "Add prompt instruction: before sales_create_meeting, agent must ask about budget/vehicle preference if not already stated."
    },
    {
      "type": "agent_behavior",
      "pattern": "Agents do not verify vehicle availability before booking appointment.",
      "affected_calls": 2,
      "example_calls": ["Call 6", "Call 11"],
      "recommendation": "Refine sales_create_meeting trigger: require inventory_search_vehicles_v3 call immediately before booking to confirm 'sold=false'."
    },
    {
      "type": "tool_failure_handling",
      "pattern": "When sales_create_meeting returns failure, agent does not re-attempt. Falls back to callback promise without scheduling it.",
      "affected_calls": 2,
      "example_calls": ["Call 10", "Call 11"],
      "recommendation": "Add explicit retry logic to agent prompt: on tool failure, attempt once more, then escalate to live transfer if dealership open."
    }
  ]
}
```

---

## Data & Calibration Notes

**Manual calibration performed**: 11 calls scored by domain expert (product manager) against initial audit. Key learnings:

1. **Information Accuracy**: Match agent statement to *specific vehicle being described*. Initial audit incorrectly flagged Call 7 mileage as hallucination; tool actually returned correct data for BMW X3 2004 (161,878 miles).
2. **Conversion**: Qualification questions are a mandatory precursor. Agent can find right vehicle but booking is score 2 (Partial) if no qualifying questions asked.
3. **Tool Failures**: Multiple calls showed `sales_create_meeting` or `communication_transfer_call_v3` returning failure. Agent's response (retry vs. escalate) is now part of the BARS anchor.
4. **Conversation Quality**: Silence handling, monologue length, and call-end sign-off are specific behavioral anchors, not generic "warm" judgments.
5. **N/A Handling**: Escalation should be N/A when no transfer/callback trigger existed. This reduces noise and forces dimension relevance.

---

## Implementation Status

- ✅ **Call Type Classification**: Intent classification prompt written (`eval-prompt-intent-classification.md`). Produces call_type, primary_intent, intents[], intent_resolution_rating.
- ✅ **6 BARS Dimensions**: All prompts written (information-accuracy, lead-qualification-conversion, tool-accuracy, escalation, conversation-quality). Response latency scoring integrated into runner.
- ✅ **Eval Runner**: Built (`run-evals-openai.py`). Detects old vs new format, computes timing metrics, classifies calls (Step 0), scores all 6 dimensions, handles N/A dimensions, produces per-call and batch aggregation JSON.
- ✅ **Latency & Dead Air**: Message timestamps (time, endTime, duration, secondsFromStart) extracted from new format calls. Agent response latency and customer dead air gaps computed. Response Latency dimension integrated into overall score with 10% weight.

## Future Work

- Add human calibration workflow to validate LLM scores against domain expert audit (sample of 10–15 calls)
- Integrate eval results into dashboard for ongoing call quality monitoring
- Develop capability gap remediation playbooks (prompt engineering, system improvements) based on recurring issue patterns

