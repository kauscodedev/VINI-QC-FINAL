# Eval Prompt: Information Accuracy

> Judge whether vehicle details stated by the agent match the tool results for the vehicles being described.

---

## Input

You will receive an **Extracted Call Context** with:
- Conversation transcript (numbered turns)
- Tool calls & results (with vehicle data)
- System prompt summary

---

## Task

**Score the agent's Information Accuracy on a 1-3 scale.**

Evaluate accuracy across ALL tool calls made in the conversation, not just inventory searches. Check:
- Inventory details (vehicle specs, price, mileage, condition, year/make/model/trim)
- CarFax details (ownership count, accident history, mileage from history)
- Finance information (available lending types, lender options)
- Dealership hours (open/close times, department availability)
- Any other tool result data the agent relayed to customer

Pay special attention to: **match the agent's statement to the tool result for the data point in question** — don't assume the same vehicle/data throughout the call.

---

## BARS Criteria

### Score 3 (Success)
ALL factual claims by the agent match tool results or context data:

**Vehicle Details**: Price, mileage, condition, year, make, model, trim all match tool result. No contradictions. Minor rounding OK (e.g., "about 30,000 miles" vs "30,778 miles").

**Dealership Hours**: Agent stated "we're open until 6pm" or "closed tomorrow" matches `dealership_check_hours` tool result OR ContextData.Dealership.Hours. Conversions between time format are correct (morning→9am, afternoon→2pm).

**Financing Availability**: Agent said "we offer leasing" and tool returned `lease: true`. Agent said "loan options available" and tool returned `loan: true`. No false positives.

**Appointment/Callback Confirmations**: Agent told customer "your appointment is scheduled for Tuesday at 3pm" and `sales_create_meeting` returned confirmed time matching that. Agent confirmed callback scheduled when they said they would.

**Transfer Availability**: Agent said "service department is available" and tool returned `status: OPEN`. Agent said "finance is closed, I'll schedule a callback" and tool returned `status: DEPARTMENT_CLOSED`.

**Other Tool Data**: Any data from `inventory_get_carfax_history`, `sales_get_finance_partners`, or `communication_send_sms` matches the tool result accurately.

### Score 2 (Partial)
Mostly accurate, but one error on a non-critical fact:

**Vehicle Details**: All core fields correct (price, mileage, condition, year/make/model), but agent misstated trim, interior color, or a feature that didn't affect the buying decision.

**Hours/Financing/Confirmations**: Agent misstated hours (said 5pm when it's 6pm), or mentioned a financing option that wasn't confirmed by tool result, but corrected it later OR the error didn't affect decision-making.

**Appointment Details**: Agent confirmed "Tuesday at 3pm" but tool result showed "Tuesday at 2:30pm" — close but not exact. Customer didn't catch the discrepancy, but it's a score 2 issue.

### Score 1 (Failure)
Major contradiction between agent's claim and tool result:

**Vehicle Details**: Agent stated price, mileage, condition, year, or make/model that directly contradicts the tool result for that vehicle.

**Hours/Availability**: Agent said "we're open until 6pm" but tool showed closed. Agent said "finance department is available now" but tool returned `DEPARTMENT_CLOSED`.

**Financing**: Agent said "we offer leasing" but tool returned `lease: false`. Agent invented lender names or options not in tool result.

**Appointment/Callback**: Agent told customer "I've scheduled your appointment for Tuesday at 3pm" but `sales_create_meeting` returned "Tuesday at 2:00pm" or never returned success.

**Hallucinated/Wrong Vehicle**: Agent matched wrong vehicle's data to customer's inquiry. Agent invented specs with zero tool support or context data.

---

## Detection Process

**CRITICAL RULE — Omission vs. Contradiction**: Do NOT penalize for omissions. If the agent did not mention a detail from the tool result (e.g., did not state mileage), that is NOT an accuracy failure. Only flag if the agent STATED something that directly contradicts or is not supported by the tool result. "Agent chose not to mention X" ≠ "Agent said the wrong X."

**Step 1: Identify all information statements in transcript**
- When does agent state any fact that came from a tool result? (inventory details, CarFax data, finance options, hours, etc.)
- What did the tool return for that fact?
- For vehicle details: what was the tool result for that vehicle?
- Also check: if agent confirmed customer phone number digits, note the digits stated and the CustomerPhoneNumber in system prompt

**Step 2: For each statement, verify**
- Is there a tool result that supports this statement?
- Does the stated detail directly contradict the tool result?
- If multiple vehicles discussed, confirm agent is describing the right one
- If using data from a tool called earlier in the call, verify it still matches current context (or flag if outdated)
- **Rounding is acceptable**: mileage rounded to nearest 1,000 within ~3% of actual value is not a contradiction. (e.g., 87,895 → "88,000 miles" ✅; 14,595 → "about 14,000 miles" ✅; 197,973 → "about 200,000 miles" ✅)
- **Color approximations** that convey the same meaning are not contradictions (e.g., "Matt Black" vs "Matte Black" ✅)

**Step 3: Flag discrepancies**
- Core field STATED WRONG (price, mileage, year/make/model, condition) = likely score 1
- Secondary field STATED WRONG (trim, color, feature) = score 2 if core fields OK
- Invented details with no tool support = score 1
- Context-mismatch (agent said details of a different vehicle) = score 1
- Phone number digits confirmed incorrectly (wrong last 4 digits vs. system prompt) = flag as WRONG_CUSTOMER_INFO
- DO NOT flag: agent did not mention mileage / did not mention color / did not relay full vehicle spec

**Step 4: Look for patterns across call**
- Does agent contradict themselves on the same vehicle? (Score 1)
- Are all statements the agent DID make accurate throughout? (Score 3)

---

## Issues to Flag

### `WRONG_VEHICLE_INFO` (WARNING)
- **When**: Agent STATED a vehicle detail that directly contradicts the tool result for that vehicle
- **NOT when**: Agent omitted a detail, didn't mention mileage, or gave incomplete info — omission is NOT a contradiction
- **Evidence**: Quote the agent's statement + the tool result showing the contradiction
- **Rounding**: Mileage rounded to nearest 1,000 within ~3% of actual value is acceptable (87,895 → "88,000 miles" ✅). Clearly off rounding (e.g., 197,973 → "about 50,000 miles") is a contradiction.
- **Color**: Approximations conveying the same meaning (e.g., "Matt Black" vs "Matte Black") are NOT contradictions.

### `WRONG_CUSTOMER_INFO` (WARNING)
- **When**: Agent stated or confirmed customer personal details (phone number, name) that do NOT match the system prompt
- **Most common case**: Agent confirmed the wrong last 4 digits of the customer's phone number
- **How to check**: Look at CustomerPhoneNumber or CurrentPhoneNumber in the system prompt. Extract the last 4 digits. If agent confirmed different last 4 digits → flag.
- **Evidence**: Quote agent's confirmation + the actual digits from the system prompt
- **Example**: "Agent confirmed 'ending in 2492' but system prompt shows CustomerPhoneNumber: +17152928942 (actual last 4: 8942)"

### `HALLUCINATED_DATA` (WARNING or CRITICAL)
- **When**: Agent stated vehicle details/specs/availability BUT no tool call was made during the call to retrieve that information
- **ONLY flag if**:
  1. Agent stated specific vehicle details (price, mileage, color, features, availability, condition, etc.), AND
  2. NO tool call (like `inventory_search_vehicles_v3`) was made in the entire call to retrieve this information
  3. This indicates the agent is either guessing, hallucinating, or using unverified information
- **ALSO flag if**:
  - Agent stated vehicle details that DIRECTLY CONTRADICT a tool result that WAS returned (wrong year, wrong make/model, wrong price — not just omitted a field)
- **DO NOT flag if**:
  - A tool call WAS made and the agent's statement matches or reasonably aligns with the result
  - Agent stated general information (dealership hours, policy) not related to specific vehicles
  - Agent relayed some tool result fields but omitted others — incomplete relay is NOT hallucination
- **Evidence**: Note whether tool call was made; quote agent's statement about vehicle details; if tool called, quote contradicting result
- **Examples**:
  - ❌ **DO FLAG**: "Agent said '2024 Accord available, $28,500' but NO inventory_search was called in the call" (hallucinated without tool)
  - ❌ **DO FLAG**: "Agent said '2024 Accord in stock' but tool search returned zero Accords" (tool contradicts statement)
  - ✅ **DO NOT FLAG**: "Agent said '2024 Accord, $28,500' and inventory_search WAS called returning that exact vehicle" (tool confirms)
  - ✅ **DO NOT FLAG**: "Agent said 'dealership is open 9-6 Monday-Saturday'" (general info, not vehicle-specific)
  - ✅ **DO NOT FLAG**: "Agent mentioned vehicle name and price but omitted mileage" (omission, not hallucination)

---

## Output Format

Return valid JSON:

```json
{
  "dimension": "information_accuracy",
  "score": 3,
  "reasoning": "Agent stated all vehicle details matching tool results: 2015 Mitsubishi Outlander Sport, $4,995, 30,778 miles. No contradictions or hallucinations detected.",
  "issues": []
}
```

If issues found:

```json
{
  "dimension": "information_accuracy",
  "score": 1,
  "reasoning": "Agent invented vehicle details not supported by tool results. Multiple contradictions on core fields (year, mileage).",
  "issues": [
    {
      "type": "HALLUCINATED_DATA",
      "severity": "warning",
      "agent_claim": "2024 BMW X3",
      "tool_result": "2004 BMW X3",
      "turn": 12,
      "evidence": "Agent stated 'newer 2024 BMW X3' but search result showed only 2004 model available"
    },
    {
      "type": "WRONG_VEHICLE_INFO",
      "severity": "warning",
      "field": "mileage",
      "agent_stated": "about 160,000 miles",
      "tool_result": "161,878 miles",
      "turn": 15,
      "evidence": "Technically correct rounding, but used in context of wrong vehicle. See issue above."
    }
  ]
}
```

---

## Special Cases

**N/A scenario**: If the call contains no vehicle descriptions (e.g., "when are you open?"), mark as N/A:

```json
{
  "dimension": "information_accuracy",
  "score": "N/A",
  "reasoning": "No vehicle details stated by agent. Call was informational only (dealership hours inquiry)."
}
```

**Multiple vehicles**: If agent discussed 3+ vehicles, evaluate each separately. If 2 out of 3 have accurate data, that's likely score 2 (Partial). If all 3 have errors, score 1.

**Tool error**: If a tool returned an error result and the agent acknowledged it correctly ("looks like that vehicle is sold"), that's not an accuracy failure — that's correct behavior.

---

## Examples from Real Calls

**Call 2 (Score 3)**:
- Transcript: "I see it on your website, the 2015 Mitsubishi Outlander Sport"
- Tool result: year 2015, make Mitsubishi, model Outlander Sport, price $4,995, mileage 30,778
- Agent stated: "2015 Mitsubishi Outlander Sport... for $4,995"
- Result: ✅ Exact match. No issues.

**Call 7 (Score 3 after correction)**:
- Transcript: Customer asks about Altima. First search returned "2024 Nissan Altima S, 32,000 miles"
- Later: Customer asks about "the BMW" (context confusion). Tool result for that search shows "2004 BMW X3, 161,878 miles"
- Agent stated for BMW: "161,878 miles"
- Result: ✅ Correct for BMW. Initially flagged as wrong, but agent was describing different vehicle.

**Call 4 (Score 3)**:
- Agent found vehicles, stated price and condition correctly
- Customer confirmed budget match
- All details verified against tool results
- Result: ✅ All accurate.

