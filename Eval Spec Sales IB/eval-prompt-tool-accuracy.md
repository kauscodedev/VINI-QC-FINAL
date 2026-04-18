# Eval Prompt: Tool Accuracy

> Judge whether each tool was called correctly, with right parameters, and results were properly relayed. Evaluate all 7 tools, aggregate to overall Tool Accuracy score.

---

## Input

You will receive an **Extracted Call Context** with:
- Conversation transcript (numbered turns)
- Tool calls & results (with parameters and responses)
- System prompt summary

---

## Task

**Evaluate each tool invocation on a 1-3 scale, then aggregate to overall Tool Accuracy score (1-3).**

For each tool present in the call:
1. Check trigger: Was it called when needed? (Or should it have been called but wasn't?)
2. Check params: Are they correct per the tool's rules?
3. Check relay: Did agent communicate the result correctly to customer?
4. Check error handling: If tool returned failure/error, did agent handle it correctly?

Then aggregate across all tools.

---

## Per-Tool BARS Criteria

### `inventory_search_vehicles_v3`

**Score 3 (Success)**
- Triggered when customer asked about inventory
- Parameters extracted from customer utterance only (make, model, year, budget, condition)
- No values invented by agent
- For ambiguous VIN/stock input, agent passed SAME value to both `vin` AND `stock` fields
- Results relayed accurately:
  - Agent stated "new" or "pre-owned" correctly for each vehicle
  - Price, year, make, model, trim all match tool result
- Did not call tool repeatedly for same query without broadening filters

**Score 2 (Partial)**
- Tool called with valid params, but one of:
  - Agent misrepresented one result field to customer (wrong trim stated, mileage rounded incorrectly, wrong price)
  - Called tool multiple times when earlier search results in the call already had the answer (reusing context is OK; redundant calls are not)
  - Made a search call that didn't expand search criteria or customer preferences beyond previous call

**Score 1 (Failure)**
- Agent answered inventory question without calling tool (invented details)
- Violated ABSOLUTE IDENTIFIER rule (customer gave VIN/stock but agent added make/model filters in same call)
- Misinterpreted param type (customer stated price but agent passed as stock number, fetched wrong vehicle)
- Extracted param from wrong vehicle (customer mentioned two vehicles, agent called search for the wrong one)

**Note on price ranges**: Agent passing `[27000, 33000]` for "around 30K" is GOOD behavior — finding vehicles close to budget, not exactly what customer said. This is intentional and should not be scored as an error.

---

### `inventory_get_carfax_history`

**Score 3 (Success)**
- Triggered when customer asked about history, accidents, previous owners on used vehicle
- Called with correct full 17-char VIN from prior tool result
- Results relayed correctly:
  - Ownership count stated first
  - Accident history only when asked
  - Service history stated concisely
  - Dates in natural language ("February 2015"), not raw format
  - Mileage rounded ("about 22,000 miles"), not exact digits
- Did not call twice for same VIN in same call

**Score 2 (Partial)**
- Called with correct VIN, but violated output format:
  - Read VIN digits character-by-character ("K-L-4...")
  - Gave dates in raw format ("02-15-2015")
  - Read exact odometer digits instead of rounding
- Agent called this for a new vehicle (should have said "new vehicles have no history" instead)

**Score 1 (Failure)**
- Customer asked about vehicle history on used vehicle, agent answered without calling tool
- Agent called it twice for same VIN in same call
- Agent shared CarFax details via SMS/email when policy only allows verbal or in-person

---

### `dealership_check_hours`

**Score 3 (Success)**
- Triggered for specific date/time availability query (not general "what are your hours?")
- Called with correct YYYY-MM-DD date
- Called with correct HH:mm time with proper conversions:
  - "morning" → "09:00"
  - "afternoon" → "14:00"
  - "evening" → "17:00"
- Called with correct department ("sales" default)
- Did not call for general hours (uses ContextData.Dealership.Hours instead)

**Score 2 (Partial)**
- Called for general hours inquiry when ContextData should have been used
- Called with approximate but wrong time conversion
- Called the same date/time/department a second time when result already known

**Score 1 (Failure)**
- Customer asked "are you open [specific day/time]?", agent answered from memory without calling tool
- Agent called with wrong date format (not YYYY-MM-DD)
- Agent called tool but ignored result, stated different hours

---

### `communication_transfer_call_v3`

**PREREQUISITE — Check `<AvailableTransferDepartments>` before flagging MISSED_TOOL_CALL:**
Before flagging any MISSED_TOOL_CALL for this tool, check the system prompt's `<AvailableTransferDepartments>` tag:
- Tag is **EMPTY** (`<AvailableTransferDepartments></AvailableTransferDepartments>`): agent has no transfer capability. Callback is the correct path. Do **NOT** flag MISSED_TOOL_CALL.
- Tag **lists the requested department**: agent had capability and didn't use it → flag as MISSED_TOOL_CALL.
- Tag is **non-empty but does NOT list the requested department**: agent correctly cannot transfer that dept → do NOT flag.

**Important**: This tool checks department hours internally — agent does NOT need to call `dealership_check_hours` before attempting transfer. If department is closed, the tool returns `status: "DEPARTMENT_CLOSED"` with guidance to offer callback instead. **CRITICAL**: If tool returns DEPARTMENT_CLOSED, agent MUST NOT attempt transfer. Agent must pivot to callback. Verbal callback confirmation in the transcript is sufficient — there is no required callback tool.

**Score 3 (Success)**
- Transfer was warranted (customer asked for human, frustration evident, scope exceeded)
- Agent spoke hold message aloud in same turn as tool call
- Complete summary included:
  - Customer name
  - Vehicle of interest (if applicable)
  - Reason for transfer
- Agent did NOT put customer name in the `name` field (that field is for destination staff)
- Error handling (CRITICAL):
  - If tool returned DEPARTMENT_CLOSED: Agent immediately pivoted to callback and verbally confirmed it ✅. Did NOT attempt transfer ✅.
  - If TRANSFER_FAILED: Agent apologized and offered callback ✅
  - If AMBIGUOUS: Agent read options to customer ✅
- Tool returned success OR agent handled failure per guidance above

**Score 2 (Partial)**
- Transfer was appropriate but:
  - Summary was vague/incomplete (missing vehicle name, customer name, or reason)
  - Transfer slightly premature (one more engagement attempt could have resolved it)
  - Hold message missing
  - Tool returned failure and agent offered callback verbally but did not clearly confirm it was scheduled

**Score 1 (Failure)**
- **CRITICAL**: Tool returned DEPARTMENT_CLOSED; agent attempted transfer anyway (ignored tool guidance)
- **CRITICAL**: Tool returned DEPARTMENT_CLOSED; agent offered callback but never called `sales_create_meeting` to schedule it
- Agent put customer's personal name in the `name` field (field misuse)
- Transfer executed with no summary at all
- Agent transferred on first objection without attempting engagement first
- Tool returned TRANSFER_FAILED and agent did not offer or follow up with callback

---

### `sales_create_meeting`

**Important**: There is no dedicated callback tool in the current agent setup. Callbacks are handled verbally — if the agent confirmed in the transcript that a callback was scheduled, that is sufficient. Do NOT evaluate or penalize tool accuracy based on the presence or absence of a tool call for callback scheduling.

If `sales_create_meeting` IS called in a context that is clearly a callback (not a test drive / in-person visit), flag `WRONG_TOOL_PARAMS` (wrong tool for purpose), but this alone does not reduce the overall Tool Accuracy score. Only evaluate this tool when the agent is scheduling an in-person appointment.

**Score 3 (Success)**
- Customer confirmed BOTH date AND time in conversation before appointment was offered
- Agent then mentioned scheduling the appointment (or called tool if available)
- Appointment details align with what customer discussed:
  - Correct `intent` matching customer discussion ("test_drive" if customer said test drive)
  - Date + time both explicitly confirmed
  - Vehicle (VIN or vehicle name) mentioned in context
  - Customer phone/name captured if provided
- Agent confirmed appointment details to customer

**Score 2 (Partial)**
- Appointment mentioned/scheduled but:
  - VIN/vehicle details omitted when vehicle was specifically discussed
  - Time confirmed but date wasn't explicitly confirmed (agent assumed "tomorrow")
  - Customer name or phone missing when provided in call
  - Agent did not confirm appointment details back to customer

**Score 1 (Failure)**
- Customer confirmed they want an appointment (stated date + time + agreed) but agent never mentioned scheduling it
- Appointment was vague (date or time not both explicitly confirmed)
- Agent invented appointment details not discussed with customer
- Critical customer detail missing (phone number when it was provided)

---

### `communication_send_sms`

**Score 3 (Success)**
- Customer explicitly asked to receive address via TEXT/SMS
- Agent first read address aloud, then asked "Would you like me to text that to you?"
- Customer confirmed yes
- Called with `messageType: "address"` and correct E.164 phone
- Only called once per call

**Score 2 (Partial)**
- Agent called without explicitly asking permission (skipped "Would you like me to text that?" step)
- Attempted second SMS in same call after first succeeded

**Score 1 (Failure)**
- Agent sent SMS without first reading address aloud (procedure violation)
- Texted address when customer only asked to hear it (didn't request text)
- Used wrong messageType or sent non-address content

---

### `sales_get_finance_partners`

**Score 3 (Success)**
- Triggered when customer asked about financing, loan, lease, or specific lender
- Tool called, result received
- Agent only mentioned financing types that returned as `true` in `financeOptions`
- If `lease: false`, agent never mentioned lease as option
- Accurately relayed available partners if asked

**Score 2 (Partial)**
- Tool called correctly, but agent mentioned financing type not confirmed by result (e.g., "we offer leasing" when tool showed `lease: false`)
- Agent failed to answer lender question even though tool result contained answer

**Score 1 (Failure)**
- Customer asked about financing, agent answered without calling tool (invented lender names or assumed availability)
- Agent mentioned financing options that contradict tool result

---

## General Rules

### Phone Digit Counting for Confirmations
When checking phone number confirmations in the transcript, count **actual digit characters**, not space-separated tokens:
- "5 2 0 1" = **4 digits** (correct confirmation of last 4 digits)
- "4 1 7" = **3 digits** (incorrect — only 3 digits confirmed)

Do not penalize agents for spacing digits when reading them aloud, as long as the digit count is correct.

---

## Aggregation Logic

After scoring each tool invocation (1/2/3), aggregate to overall Tool Accuracy score:

```
Tool Accuracy Score (1-3) =
  3 (Success):   All invocations scored 3. No missed tool calls.
  2 (Partial):   All invocations scored 2 or 3 (none scored 1). OR one missed tool call of WARNING severity.
  1 (Failure):   Any invocation scored 1. OR any missed tool call of CRITICAL severity. OR IGNORED_TOOL_GUIDANCE present.

N/A tools (not invoked, not needed): excluded from scoring
Missed tool calls (not invoked, SHOULD have been): scored as 1 for that tool
```

---

## Missed Tool Call Detection

A tool is "missed" if the agent SHOULD have called it but didn't. **IMPORTANT: Only applies to SALES calls, not service/parts routing.**

| Trigger | Tool | Applies To | Severity |
|---------|------|-----------|----------|
| Customer asked "when can I come?" (sales context) | `sales_create_meeting` | Sales calls only | CRITICAL |
| Customer asked "when can you call me back?" (sales context) | *(no tool required — verbal confirmation in transcript is sufficient)* | — | — |
| Customer asked "are you open [specific time]?" | `dealership_check_hours` | All calls | WARNING |
| Customer asked about vehicle history on used car | `inventory_get_carfax_history` | Sales calls only | WARNING |
| Customer said "send me the address via text" | `communication_send_sms` | Sales calls only | CRITICAL |
| Agent out of scope, customer needs human | `communication_transfer_call_v3` | All calls | CRITICAL* |
| Customer asked about financing options (sales context) | `sales_get_finance_partners` | Sales calls only | WARNING |
| Customer asked about inventory (sales context) | `inventory_search_vehicles_v3` | Sales calls only | WARNING |

\* Only applies when `<AvailableTransferDepartments>` is non-empty and lists the requested dept. If tag is empty, no transfer capability exists.

**Key rule**: For service/parts/finance routing calls where customer explicitly asked for that department, NO tool calls should be expected. Agent should engage briefly then transfer. Do NOT flag as `MISSED_TOOL_CALL`.

---

## Issues to Flag

### `WRONG_TOOL_PARAMS` (WARNING)
- Tool called, but parameters violated tool's documented rules
- **Examples**:
  - `inventory_search`: Ambiguous identifier (VIN or stock) → agent filled only one field instead of both
  - Param type misinterpreted (customer said price, agent passed as stock, fetched wrong vehicle)
  - Param extracted from wrong vehicle (customer mentioned two vehicles, agent called search for the wrong one)
- **Note**: Passing price range broader than stated (customer "around 30K" → agent searches `[27000, 33000]`) is GOOD behavior, not an error
- **Evidence**: Quote the tool call parameters + explain the violation

### `IGNORED_TOOL_GUIDANCE` (CRITICAL)
- Tool result explicitly returned error status + instruction
- Agent did not follow the guidance
- **Example**: Tool returned `status: "DEPARTMENT_CLOSED"` + message: "Offer callback instead." Agent called transfer anyway.
- **Evidence**: Tool status + message + agent's contradictory action

**Exception — Mid-Call Request Change**: If tool returned DEPARTMENT_CLOSED for Dept A, but the customer subsequently and explicitly asked to be routed to Dept B instead, and the agent transferred to Dept B, this is **NOT** IGNORED_TOOL_GUIDANCE. The customer's updated request supersedes the original routing failure.

### `MISSED_TOOL_CALL` (WARNING or CRITICAL, per table above)
- Agent should have called a tool but didn't
- **Example**: Customer asked "when can I come check it out?" but agent never called `sales_create_meeting`
- **Evidence**: Customer request in transcript + note that tool was never called

### `WRONG_SEARCH_CRITERIA` (WARNING)
- **When**: Agent infers search parameters from customer utterance, but the parameters don't match what customer asked for
- **Detection**: Analyze what customer said → infer intended search criteria → compare to actual tool call parameters
- **Examples**:
  - Customer: "I want exactly 126,717 miles" → Agent called: `odometer: [126000, 126717]` (range instead of exact). Flag: "Customer requested exact mileage (126,717), but agent searched for a range (126,000–126,717)."
  - Customer: "Show me a 2024 Honda" → Agent called: `stock_number: "XYZ123"` without make/model filters. Flag: "Customer specified 2024 Honda, but agent searched only by stock number."
  - Customer: "I'm looking for used cars under 25K" → Agent called: `[make: "Toyota", budget: 35000]` (wrong budget or brand). Flag: Mismatch between stated criteria and tool params.
- **Note**: Broadening criteria is OK (customer "around 30K" → agent searches `[27000, 33000]`). Narrowing or misinterpreting is NOT OK.
- **Evidence**: Quote customer's stated criteria + actual tool call parameters + explain the mismatch
- **Score Impact**: Flags as WARNING; contributes to Score 1 or 2 on inventory_search tool if search fails or returns irrelevant results

### `TOOL_SEARCH_ISSUES` (WARNING or CRITICAL)
- **When**: Inventory search fails to find vehicle, returns wrong results, or inefficiently searches
- **Detection**: Compare customer's request → tool parameters → tool result → what agent told customer
- **Sub-types**:
  - **Search Filter Failed**: Tool returned too many results (e.g., odometer filter failed, returned all 194 vehicles when it should have narrowed to 5)
    - Flag as: "Inventory search returned 194 results instead of filtering by odometer range; agent did not apologize or reframe."
  - **Wrong Vehicle Returned**: Tool search succeeded but returned vehicle that doesn't match criteria
    - Example: Customer asked for "mileage around 126K" → Tool returned vehicle with 137K miles as first result. Flag: "Tool returned vehicle with 137,000 miles when customer specifically requested ~126,717 miles."
    - Severity: CRITICAL if agent showed this as the match, WARNING if agent noted it doesn't match
  - **No Vehicle Found**: Tool search succeeded but returned no results when vehicles should exist in inventory
    - Flag as: "Search returned 0 results for [criteria]; agent did not expand criteria, apologize, or offer alternative."
    - Severity: CRITICAL if this ends the conversation, WARNING if agent recovers
  - **Inefficient Search Pattern**: Agent asks customer for stock number instead of searching by make/model/year
    - Flag as: "Agent asked customer for stock number instead of searching by make, model, year; customer already provided these details."
    - Severity: WARNING
- **Evidence**: Quote customer's request + tool parameters + tool results (if any) + how agent explained result to customer
- **Score Impact**: Flags as WARNING or CRITICAL depending on impact; contributes to Score 1 or 2 on inventory_search tool if search fails to support conversion

---

## Output Format

```json
{
  "dimension": "tool_accuracy",
  "score": 3,
  "tool_breakdown": [
    {
      "tool": "inventory_search_vehicles_v3",
      "score": 3,
      "reasoning": "Called once with correct params (make, model, year, budget). Results relayed accurately."
    },
    {
      "tool": "sales_create_meeting",
      "score": 3,
      "reasoning": "Called with confirmed date + time. All params correct (intent, phone format, VIN, customer name). Appointment confirmed to customer."
    }
  ],
  "overall_reasoning": "All tool invocations scored 3. No missed calls. Proper parameter extraction and result relay throughout.",
  "issues": []
}
```

If score 1 or 2:

```json
{
  "dimension": "tool_accuracy",
  "score": 1,
  "tool_breakdown": [
    {
      "tool": "inventory_search_vehicles_v3",
      "score": 2,
      "reasoning": "Called 3 times in succession for same query without broadening filters. Results stated correctly, but inefficient pattern."
    },
    {
      "tool": "sales_create_meeting",
      "score": 1,
      "reasoning": "Customer confirmed 'tomorrow afternoon' and said she wanted to come check it out. Agent never called this tool to book appointment."
    }
  ],
  "overall_reasoning": "Inventory search score 2 (redundant calls). sales_create_meeting score 1 (missed critical call). Overall score 1.",
  "issues": [
    {
      "type": "MISSED_TOOL_CALL",
      "severity": "critical",
      "tool": "sales_create_meeting",
      "context": "Customer showed clear buying signal ('when can I come check it out?') but no appointment was attempted",
      "turn": 12,
      "evidence": "Customer asked 'when can I come check it out?' (turn 12). Agent found vehicle and stated mileage. But no sales_create_meeting called. Call ended without booking."
    }
  ]
}
```

---

## Examples from Real Calls

**Call 4 (Score 3)**:
- `inventory_search_vehicles_v3`: 1 call with correct budget params. Results relayed accurately. Score 3.
- `sales_create_meeting`: Date + time confirmed ("Wednesday 2 PM"). All params correct. Score 3.
- `communication_send_sms`: Customer asked for address via text. Agent asked permission. Called with correct phone. Score 3.
- Overall: ✅ Score 3. All tools scored 3.

**Call 7 (Score 1)**:
- `inventory_search_vehicles_v3`: Called 3 times for same query. Parameters valid but redundant. Score 2.
- `sales_create_meeting`: Customer said "when can I come check it out?" (CRITICAL trigger). Never called. Score 1 (missed critical call).
- Overall: ❌ Score 1. Missed critical tool call.

**Call 1 (Score 1)**:
- `communication_transfer_call_v3`: Tool returned `status: "DEPARTMENT_CLOSED"` with message "Offer callback instead." Agent transferred anyway. Score 1 (ignored tool guidance).
- `sales_create_meeting`: Agent promised callback but never called to schedule. Score 1 (missed critical call).
- Overall: ❌ Score 1. Multiple critical failures + ignored tool guidance.

