# Eval Prompt: Escalation & Transfer Handling

> Judge whether the agent transferred calls or scheduled callbacks at the right time, with accurate context.

---

## Input

You will receive an **Extracted Call Context** with:
- Conversation transcript (numbered turns)
- Tool calls & results (including `communication_transfer_call_v3` and `sales_create_meeting` for callbacks)
- System prompt summary

---

## Task

**Score Escalation & Transfer Handling on a 1-3 scale.**

Evaluate:
1. **Timing**: Was transfer/callback needed and was it triggered at the right moment?
2. **Context**: Did agent provide complete summary (customer name, vehicle, reason)?
3. **Tool correctness**: Did agent handle tool results correctly (especially error statuses)?

---

## BARS Criteria

### Score 3 (Success)
- Transfer or callback was clearly warranted:
  - Customer explicitly asked for human (asked twice, not once) — on `vague_routing` calls only
  - For `explicit_dept_routing` calls: Customer asked for a specific department/person by name — immediate transfer is correct
  - Frustration evident (angry tone, repeated objections)
  - Topic exceeded agent scope (financing, warranty, service)
  - System limitation hit (e.g., tool error, inventory unavailable)
  - Tool returned explicit error guidance (DEPARTMENT_CLOSED → "offer callback instead")
- Agent provided complete summary (for non-explicit-dept calls):
  - Customer name included
  - Vehicle of interest named
  - Reason for transfer stated
- Agent did NOT put customer name in the `name` field of transfer tool (that field is for destination staff only)
- If tool returned error status:
  - DEPARTMENT_CLOSED → agent offered callback ✅
  - TRANSFER_FAILED → agent apologized, offered callback ✅
  - AMBIGUOUS → agent read options to customer ✅
- Tool returned success
- **For non-explicit-dept routing**: Agent recommended appointment as alternative before offering transfer/callback

### Score 2 (Partial)
- Transfer or callback was executed, but:
  - Summary was vague or incomplete (missing vehicle name, customer name, or reason)
  - Transfer slightly premature (one more engagement attempt could have resolved it)
  - Hold message was missing
  - Tool returned failure and agent did not re-attempt or escalate to live transfer
  - Agent asked "what day/time works for a callback?" instead of scheduling urgently

### Score 1 (Failure)
- Tool returned DEPARTMENT_CLOSED or TRANSFER_FAILED and agent ignored guidance (retried transfer or abandoned customer)
- Transfer executed with no summary at all
- Agent transferred on first customer objection without attempting engagement (on vague routing calls)
- Agent put customer's personal name in the `name` field of transfer tool (misuse of field)
- Callback scheduled but agent asked customer "what day/time works for you?" instead of scheduling urgently ("right away" or "today")

**Note on callback tool**: There is no dedicated callback tool in the current agent setup. Verbal confirmation of callback scheduling in the transcript is sufficient. Do NOT score as 1 solely because no callback tool was called — evaluate whether the agent verbally confirmed the callback was scheduled.

---

### For `complaint_call` Calls
(Customer raises post-purchase dissatisfaction, delivery complaint, broken promise, F&I dispute, price discrepancy, mechanical issue, hostile/abusive behavior, or third-party escalation)

**Score 3 (Success)**
- Agent responded with empathy IN THE SAME TURN the complaint was raised:
  - ✅ "I'm really sorry to hear that"
  - ✅ "I completely understand how frustrating that must be"
  - ✅ "I apologize you're experiencing that" (equivalent empathetic acknowledgment)
  - ❌ Skipped empathy and went straight to action/transfer
- Agent did NOT argue, defend, minimize, or dismiss the complaint
- Agent transferred to the correct department (post-purchase issues → service, financial disputes → F&I, general dissatisfaction → manager/escalations team) with complete summary:
  - Complaint type stated clearly (e.g., "customer has mechanical issue post-purchase")
  - Customer name included
  - Vehicle name/VIN if relevant
  - Brief context ("vehicle broke down after two days")
- For hostile/abusive callers: Agent remained calm and professional, did NOT match hostility or escalate tension, transferred to manager/senior staff
- Transfer executed with tool call OR callback confirmed verbally with urgency

**Score 2 (Partial)**
- Agent transferred to correct department but:
  - No empathy acknowledgment before transfer, OR
  - Summary incomplete (missing complaint type, customer name, or context), OR
  - Agent asked customer to call back instead of routing directly
- Agent was empathetic but transferred to wrong department (e.g., transferred delivery complaint to sales instead of operations/logistics)
- For hostile caller: Agent was professional but didn't acknowledge frustration

**Score 1 (Failure)**
- Agent argued with customer, disputed the complaint, or said "that's not our policy" (defensive response)
- Agent provided NO empathy acknowledgment AND transferred (or vice versa)
- Agent offered no transfer or next step at all when complaint clearly required escalation
- For hostile/abusive caller: Agent escalated tension, matched hostility, or threatened to end call without offering resolution path
- Transfer failed and agent did not offer callback alternative

---

## Important: Hours Checking

The `communication_transfer_call_v3` tool checks department hours **internally**. Agent does NOT need to call `dealership_check_hours` first. If department is closed, the tool returns `status: "DEPARTMENT_CLOSED"` with the message "offer callback instead."

**CRITICAL**: When tool returns DEPARTMENT_CLOSED, agent MUST NOT attempt the transfer. Agent must immediately pivot to callback by calling `sales_create_meeting` with `intent: "request_callback"`. Attempting transfer when status is DEPARTMENT_CLOSED is a critical failure.

---

## Detection Process

**Important: Department-Specific Exception**

For calls where the customer explicitly asked for a **specific department by name** (service, parts, finance) or a **specific person by name**, immediate transfer is correct behavior. Score 3 does not require engagement attempt or appointment bridge offer for these calls. The agent should transfer right away once they confirm they cannot help.

This exception does NOT apply to vague routing requests ("can I talk to someone?" or "a real person"). Those require engagement attempt first.

---

**Step 1: Determine if escalation WAS WARRANTED** (this is the primary check)
- **For explicit dept/person requests**: Did customer ask for service, parts, finance, or a named person? If yes, immediate transfer is correct.
- **For vague routing requests**: Did customer explicitly ask for a human (asked twice or with clear intent)? Is there frustration or anger? Did the topic go out of agent scope?
- Did a tool return an error that cannot be resolved by agent?
- Did customer request something the agent cannot do?

If escalation was NOT warranted, and agent didn't escalate, that's actually score 3 (correct). Only score 1 if agent escalated when it wasn't needed.

**Step 1.5: Check for complaint call type** (applies to all calls)
- Is the customer's reason for calling a complaint (post-purchase dissatisfaction, delivery issue, broken promise, F&I dispute, price discrepancy, mechanical issue post-purchase, feature not delivered, hostile/abusive behavior, third-party escalation)?
- **Key indicator**: Look for language expressing dissatisfaction, frustration, anger, or unmet expectations. Examples:
  - "The car you sold me broke down after two days"
  - "The dealer promised [X] and it wasn't done"
  - "I'm very upset about how my delivery went"
  - "This F&I product isn't what I thought"
  - "You quoted me a different price"
  - "I'm going to contact an attorney about this"
  - Hostile tone, raised voice, aggressive language
- If complaint detected: apply `complaint_call` BARS above
- **Score complaint on empathy + routing correctness, not on problem resolution** (agent is passing to human)

**Step 2: Check if escalation was actually done** (only if warranted in Step 1)
- If warranted: Was there a `communication_transfer_call_v3` tool call?
- If warranted but tool unavailable: Did agent mention scheduling callback in transcript?
- If neither: Score 1 (warranted but not executed)

**Step 3: Evaluate transfer/callback quality**
- Did agent speak a hold message before transferring?
- What summary did agent provide?
  - ✅ "Customer John is interested in 2015 Outlander, wants to test drive tomorrow"
  - ❌ "Customer has a question"
- What was the tool result status?
  - If `status: "DEPARTMENT_CLOSED"`:
    - ✅ Agent immediately offered callback (not transfer)
    - ✅ Agent verbally confirmed callback was scheduled
    - ✅ Agent formally scheduled callback via `sales_create_meeting` with `intent: "request_callback"` (preferred but not required)
    - ❌ Agent attempted transfer anyway (critical failure)
    - ❌ Agent offered callback verbally but did not confirm it was scheduled in any way

**Step 4: NEW — Check callback urgency (if callback was offered)**
- If callback was mentioned in the transcript, check how it was framed:
  - ✅ Urgent framing: "I'll have someone call you back right away" or "We'll call you back today, as soon as possible"
  - ✅ Default urgency: Callback scheduled for same day (today) unless customer volunteered a time
  - ❌ Non-urgent: "What day works for a callback?" or "When would you like us to call?" (agent asking customer to choose, not urgent)
  - ❌ Delayed: Callback scheduled for future day without urgency language
- If callback offered with non-urgent framing → Score 2 or 1 depending on context

**Step 5: Check tool parameter correctness**
- Transfer tool has `name` field — should this be the destination (e.g., "Sales Manager") or customer name?
  - Correct: `"name": "Sales Manager"` (destination staff)
  - Wrong: `"name": "John"` (customer name should not go here)
- Did agent call the tool with a `summary` parameter?
  - Yes: Is it >20 characters and includes vehicle/intent/customer name?
  - No: That's a miss (score 2 or 1)

**Step 6: Verify outcome**
- Did tool return success?
- If tool returned failure, what did agent do?
  - Re-attempted transfer? (Score 2 if failure repeated)
  - Offered callback instead? (Score 3, good recovery)
  - Abandoned customer? (Score 1)

---

## Issues to Flag

### `IGNORED_TOOL_GUIDANCE` (CRITICAL)
- **When**: Tool result explicitly returned error status + guidance, agent did opposite
- **Evidence**: Tool returned `status: "DEPARTMENT_CLOSED"` + message "offer callback instead"; agent called transfer anyway
- **Example**: "Tool returned DEPARTMENT_CLOSED. Agent attempted transfer_call_v3 again instead of offering callback."

### `INCOMPLETE_TRANSFER_SUMMARY` (WARNING)
- **When**: Transfer/callback executed but summary was vague or incomplete
- **Evidence**: Summary parameter was <20 chars or missing key details
- **Example**: "Summary was 'customer has question' instead of 'John interested in 2024 RDX, wants to test drive Friday'"

### `COMPLAINT_NO_EMPATHY` (WARNING)
- **When**: Agent processed or transferred a complaint without acknowledging customer's frustration or concern
- **Applies to**: Complaint calls (H.1–H.8)
- **Evidence**: Quote the turn where complaint was first raised; note absence of empathy phrase (sorry, understand, frustrating, etc.) BEFORE any action
- **Example**: "Customer said 'The car you sold me broke down after two days.' Agent responded: 'Let me transfer you to service' without any empathy phrase first."

### `COMPLAINT_NOT_ESCALATED` (CRITICAL)
- **When**: Customer raised complaint that clearly required human involvement, but agent did NOT transfer or escalate
- **Applies to**: Complaint calls (H.1–H.8)
- **Evidence**: Complaint described in transcript + no transfer tool call + no verbal callback confirmation of escalation
- **Example**: "Customer reported 'the promised feature never worked on my car.' Agent said 'I'll make a note of that' and call ended with no escalation."

### `HOSTILE_CALLER_MISHANDLED` (WARNING)
- **When**: Agent on a hostile/abusive call matched hostility, became defensive, threatened to end call, or escalated tension instead of de-escalating
- **Applies to**: H.6 (hostile or abusive caller)
- **Evidence**: Quote agent's response in comparison to customer's hostile turn
- **Example**: "Customer used aggressive language. Agent responded defensively: 'That's not my fault' or 'I'm not going to be spoken to that way.' Agent should have said 'I understand you're frustrated, let me get you to someone who can help.'"

---

## Output Format

```json
{
  "dimension": "escalation_transfer_handling",
  "score": 3,
  "reasoning": "Customer post-purchase issue clearly out of scope. Agent escalated to service with complete summary (Monday callback, blank screen issue, customer's backup phone). Appropriate timing and context.",
  "issues": []
}
```

If score 1 or 2:

```json
{
  "dimension": "escalation_transfer_handling",
  "score": 1,
  "reasoning": "Tool returned DEPARTMENT_CLOSED with explicit guidance 'offer callback instead'. Agent called transfer_call_v3 anyway. Later promised callback but never scheduled it via sales_create_meeting.",
  "issues": [
    {
      "type": "IGNORED_TOOL_GUIDANCE",
      "severity": "critical",
      "tool": "communication_transfer_call_v3",
      "guidance": "DEPARTMENT_CLOSED — offer callback instead",
      "agent_action": "attempted transfer anyway",
      "turn": 16,
      "evidence": "Tool result status: DEPARTMENT_CLOSED. Message: 'Offer callback instead'. Agent called transfer_call_v3 in turn 17 despite guidance."
    }
  ]
}
```

---

## Special Cases

**N/A scenario**: If no transfer or callback occurred AND no trigger was present (call resolved without escalation need), mark as N/A:

```json
{
  "dimension": "escalation_transfer_handling",
  "score": "N/A",
  "reasoning": "No transfer or callback needed. Call was resolved by agent (appointment booked). Escalation was not warranted."
}
```

**Callback scheduled correctly**: If agent called `sales_create_meeting` with callback intent:
- Verify date/time are confirmed in conversation (not assumed)
- Verify callback intent is set (`"intent": "callback"` or similar)
- If correct, that can count as score 3 if no transfer was needed

**Tool error recovery**: If tool returned failure and agent re-attempted once, that's score 2 (Partial). If agent re-attempted multiple times or gave up, score 1.

**Multiple departments**: If customer needed to reach multiple departments (sales + service), and agent transferred to sales but should have also set a service callback, score 2 (incomplete).

---

## Examples from Real Calls

**Call 3 (Score 3)**:
- Issue: Post-purchase (blank screen on vehicle) → clearly out of scope
- Decision: Escalate to service
- Summary: "Customer experiencing issue with vehicle display. Needs service review. Backup contact: [phone]"
- Outcome: Monday callback scheduled with complete details
- Result: ✅ Score 3. Appropriate scope boundary, complete summary, callback confirmed.

**Call 1 (Score 1)**:
- Tool returned: `status: "DEPARTMENT_CLOSED"`, message: "Offer callback instead"
- Agent action: Called `communication_transfer_call_v3` anyway (ignoring guidance)
- Later: Promised "I can set up a callback for Monday"
- But: Never called `sales_create_meeting` to schedule callback
- Result: ❌ Score 1. Ignored tool guidance + abandoned callback promise.

**Call 6 (Score 2)**:
- Issue: Customer has financing questions (agent asked to verify options)
- Decision: Book appointment for Friday, offer to check financing
- But: Agent did not verify vehicle availability before booking
- Outcome: Appointment booked, but vehicle was sold
- Result: ⚠️ Score 2. Escalation decision was OK, but booking process had a gap (should verify vehicle first).

