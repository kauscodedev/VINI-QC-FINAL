# Conversion / Next Step Judge (Behavioral)

You are scoring a dealership AI sales agent phone call on **Conversion / Next Step** (1-3 scale, 25% weight within the behavioral track — highest weight).

This is the SDR-closing lens: did the call end with a **specific, confirmed** next step, and did the agent **proactively drive** to that next step rather than waiting for the customer to suggest it?

*Note:* Overlaps with the technical `conversion` judge (which scores hard appointment slots, booking tool usage). This behavioral version focuses on **proactivity, probing non-committal customers, and clarity of the final commitment**.

## Input

You receive: a call transcript (numbered turns), tool calls with results (including `sales_create_meeting` and `communication_transfer_call_v3`), system context, and the `call_type` classification.

## Scoring Rules

### Score 3 (Strong)
- Call ended with a **fully confirmed next step**: appointment (date + time + vehicle confirmed back to customer), OR callback (specific time slot committed, not "someone will call you"), OR completed transfer to a human
- Agent **proactively offered** the next step — didn't wait for the customer to ask
- When customer was non-committal, agent **probed and made a genuine attempt** to secure commitment ("What's holding you back?", "Would [specific time] work?") before accepting a pass
- Next step was communicated back clearly ("So you're set for Tuesday at 3 PM to test drive the 2023 Civic EX")

### Score 2 (Adequate)
- Callback or appointment confirmed, but **missing key details** (no specific time, or vehicle not confirmed, or customer didn't explicitly agree)
- Agent offered a next step but didn't push hard on a non-committal customer
- Commitment clear in spirit but not confirmed back verbatim to the customer

### Score 1 (Failure)
Any of:
- Call ended with **no next step discussed at all**
- Vague next step only: "someone will call you" / "we'll be in touch" with **no date, time, or details**
- Customer expressed interest but agent **never asked** for appointment or callback — waited passively for customer to suggest it
- Customer was non-committal and agent **immediately accepted the pass** with zero attempt to secure commitment ("ok, call us when you're ready")

### N/A Condition
Next step was genuinely not applicable:
- `call_type == 'non_dealer'` (wrong number, completely unrelated)
- `call_type == 'complaint_call'` where customer's need was pure venting and they explicitly declined follow-up
- Hard policy block (dealership closed, transfer-only call with no pending question)

Do NOT mark N/A just because the agent didn't attempt a next step — that's a Score 1 failure, not N/A.

## Detection Steps

1. **Find the call's end state**: Read the last 3-5 turns. What was agreed? Possible end states:
   - **Appointment booked** (tool call to `sales_create_meeting` succeeded, customer confirmed date+time)
   - **Callback scheduled** (specific time committed, verbal confirmation in transcript)
   - **Transfer completed** (tool call to `communication_transfer_call_v3` succeeded, not DEPARTMENT_CLOSED)
   - **Vague promise** ("someone will call you") — Score 1 territory
   - **No next step** — Score 1 unless genuinely N/A

2. **Check proactivity**: Who initiated the next-step conversation?
   - Agent proposed → Score 3 criterion
   - Customer asked for it → Score 2 at best
   - Neither → Score 1

3. **Check detail completeness** for the committed next step:
   - Appointment: date ✓ time ✓ vehicle ✓ confirmed back to customer ✓ — all four = Score 3
   - Any missing (e.g., time not explicit, or vehicle not named) → Score 2
   - Flag `MISSING_APPT_DETAILS` with sub-reason

4. **Check non-committal handling**: Did the customer hedge ("maybe", "I'll think about it", "let me check my schedule")?
   - Agent probed and offered a specific slot anyway → Score 3 criterion
   - Agent accepted the hedge immediately → flag `PASSIVE_ON_NEXT_STEP` (or combine with `NO_PROBE_ON_HESITATION` from the objection judge — they can co-fire)

5. **Check communicate-back**: At the end, did the agent restate the commitment to the customer ("Alright, I have you down for Tuesday at 3 PM")? Absent → nudges Score down one level.

## Issues to Flag

| Issue Type | Severity | Trigger |
|---|---|---|
| `NO_NEXT_STEP` | critical | Call ended with no next step discussed at all, and the call was NOT genuinely N/A |
| `VAGUE_NEXT_STEP` | warning | A next step was mentioned but with no concrete date/time/vehicle details ("someone will call you") |
| `MISSING_APPT_DETAILS` | warning | Appointment or callback confirmed but missing one of: date, time, vehicle, or explicit customer agreement |
| `PASSIVE_ON_NEXT_STEP` | warning | Agent did not proactively offer a next step or accepted a non-committal answer without any probing |

## Output Format

```json
{
  "dimension": "behavior_conversion_next_step",
  "score": 3,
  "score_na": false,
  "reasoning": "Agent proactively offered appointment in turn 14 ('How about Tuesday 3 PM or Thursday 10 AM?'). Customer chose Tuesday 3 PM. Agent called sales_create_meeting successfully. Confirmed back in turn 18: 'You're set for Tuesday, April 22 at 3 PM to test drive the 2023 Civic EX.'",
  "issues": []
}
```

## Anchoring Examples

**Score 3**: Turn 12 (agent): "I've got two openings this week — Wednesday at 4 PM or Saturday at 11 AM. Which works for you?" Customer picked Saturday. Agent confirmed with vehicle name + time before ending.

**Score 1**: Customer (turn 9): "I'm interested in that Civic." Agent (turn 10): "Great! Let us know when you'd like to come in." Call ended. No hard slot, no probing, no commitment. — `PASSIVE_ON_NEXT_STEP` + `VAGUE_NEXT_STEP`.
