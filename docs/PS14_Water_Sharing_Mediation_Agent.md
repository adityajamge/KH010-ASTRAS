# PS14 --- Autonomous Water-Sharing Dispute Mediation Agent for Farmers

## 1. Project Overview

### Problem Statement

**PS14: Autonomous Water-Sharing Dispute Mediation Agent for Farmers**

The system is an agentic platform that helps farmers and water-user
groups resolve disputes over limited irrigation water.

The prototype should demonstrate a realistic situation in which multiple
farmers depend on the same canal network, available water is limited,
upstream and downstream farmers have competing requirements, and the
system must:

-   detect a conflict,
-   understand water requirements and constraints,
-   calculate a fair allocation,
-   generate an irrigation schedule,
-   explain the decision,
-   handle farmer objections,
-   revise the proposal when appropriate,
-   maintain an auditable record of the final agreement.

The core idea is **not simply a chatbot**. It is an **agentic
negotiation and decision-support system backed by deterministic
water-allocation logic**.

------------------------------------------------------------------------

# 2. Core Concept

## The Digital Water Mediator

The proposed system acts as a neutral digital mediator between farmers.

It combines:

1.  **Farmer Interface**
2.  **Water Network Digital Twin**
3.  **Water Allocation / Optimization Engine**
4.  **Constraint and Rule Engine**
5.  **Conflict Detection**
6.  **Mediation Agent**
7.  **Explanation Agent / Glass-Box Reasoning**
8.  **Negotiation Workflow**
9.  **Schedule Generator**
10. **Agreement and Audit Record**

The LLM/agents should handle language, negotiation, explanation, and
interpretation.

The deterministic software should handle:

-   arithmetic,
-   water balances,
-   constraints,
-   capacity limits,
-   allocation calculations,
-   schedule validation,
-   conflict detection.

This separation is important because an LLM should not be trusted to
perform hard numerical optimization or enforce critical constraints by
itself.

------------------------------------------------------------------------

# 3. Real-World Inspiration: Community Hydrologist / Jal Vigyani Model

The solution is inspired by the **Community Hydrologist / Jal Vigyani**
approach described by WELL Labs.

Water User Cooperative Societies (WUCS) allow farmers to collectively
manage irrigation infrastructure, distribute water, and resolve
conflicts.

A major challenge is that water allocation can become informal and
reactive during scarcity. Reliable data about actual water flow,
irrigation infrastructure, command areas, and crop requirements can
improve decision-making.

A Jal Vigyani/community hydrology role can help by:

-   mapping irrigation infrastructure,
-   documenting actual command areas,
-   monitoring water flow,
-   assessing crop water demand,
-   identifying inequities,
-   monitoring infrastructure,
-   documenting deviations from agreed norms,
-   providing evidence during disputes,
-   translating technical information into farmer-friendly decisions.

### Important design interpretation

The AI system should **not claim to replace the Jal Vigyani**.

Instead, the system can act as a **digital mediation and
decision-support layer** that uses the type of structured evidence a
community hydrology system could provide.

For the hackathon prototype, these measurements can be represented using
synthetic data.

------------------------------------------------------------------------

# 4. The Main Demonstration Scenario

## Scenario

A dam supplies water to a canal network.

The water flows through:

``` text
DAM
 │
 ▼
MAIN CANAL
 │
 ├── FARMER 1
 ├── FARMER 2
 ├── FARMER 3
 ├── ...
 ├── FARMER 8
 ├── FARMER 9
 └── FARMER 10  ← Tail-end farmer
```

There are multiple farmers.

The upstream farmers claim:

> "We have taken only our allocated water."

The tail-end farmer says:

> "I am not receiving enough water."

The system must not immediately assume that either side is lying.

Instead, it investigates the available evidence.

------------------------------------------------------------------------

# 5. What Could Cause the Dispute?

The tail-end shortage could be caused by:

1.  Legitimate upstream water usage
2.  Unauthorized water withdrawal
3.  Excessive upstream usage
4.  Leakage or seepage
5.  Blocked field channel
6.  Damaged irrigation infrastructure
7.  Incorrect allocation rules
8.  Incorrect water-flow measurements
9.  Changes in crop water requirements
10. Reduced water availability at the dam

The mediation system should distinguish between these possibilities
using the available data.

------------------------------------------------------------------------

# 6. Evidence Model

Each farmer can have structured data such as:

``` json
{
  "farmer_id": "F10",
  "position": "tail",
  "land_area_acres": 3.5,
  "crop": "Sugarcane",
  "water_requirement_liters": 9000,
  "allocated_water_liters": 7000,
  "actual_water_received_liters": 4200,
  "priority": "normal"
}
```

The canal network can have:

``` json
{
  "available_water_liters": 50000,
  "main_canal_capacity_liters": 12000,
  "flow_rate_liters_per_minute": 500,
  "loss_percentage": 8
}
```

A real deployment could obtain similar information from field
measurements, GIS, sensors, community records, or other approved data
sources.

For the hackathon prototype, the dataset should be synthetic and clearly
labelled as such.

------------------------------------------------------------------------

# 7. 3D Digital Twin

## Main Visual Differentiator

The prototype should include a **3D irrigation digital twin built with
Three.js**.

The 3D environment represents:

-   dam,
-   water reservoir,
-   main canal,
-   distributaries,
-   laterals,
-   field channels,
-   farm plots,
-   terrain/elevation,
-   farmer locations,
-   water-flow direction,
-   allocation status,
-   conflict locations.

The purpose of the 3D map is not decoration.

It should be connected directly to the decision system.

------------------------------------------------------------------------

# 8. 3D Scene Design

## Dam

Show:

-   reservoir,
-   water level,
-   outlet,
-   available water.

Example:

``` text
Available Water: 50,000 L
```

## Main Canal

Show a flowing water stream moving from the dam toward the farms.

The water animation should communicate:

``` text
DAM → MAIN CANAL → DISTRIBUTARY → FARMS
```

## Farm Plots

Represent farmers as individual plots.

Example:

``` text
F01  F02  F03  F04  F05
 F06  F07  F08  F09  F10
```

Each farmer can display:

-   farmer ID,
-   land area,
-   crop,
-   requested water,
-   allocated water,
-   actual received water,
-   status.

## Head-End / Tail-End

Visually distinguish:

-   upstream/head-end farmers,
-   middle farmers,
-   downstream/tail-end farmers.

This makes the equity problem immediately understandable to judges.

------------------------------------------------------------------------

# 9. Conflict Visualization

When a conflict is detected:

-   highlight the affected farmer,
-   highlight the relevant canal segment,
-   show the expected vs actual water,
-   display a conflict message.

Example:

``` text
⚠ WATER SHORTAGE DETECTED

Farmer F10
Expected: 7,000 L
Received: 4,200 L
Shortage: 2,800 L
```

The corresponding section of the 3D irrigation network can be
highlighted.

------------------------------------------------------------------------

# 10. Before vs After Allocation

One of the strongest demo moments should be a visible transformation.

### Before

``` text
F01  ██████████
F02  █████████
F03  █████████
...
F10  ███
```

Tail-end farmer receives insufficient water.

### Agentic Resolution

The system analyses the network and constraints.

### After

``` text
F01  ████████
F02  ████████
F03  ███████
...
F10  ███████
```

The system generates a revised schedule.

The 3D water flow and allocation indicators update accordingly.

------------------------------------------------------------------------

# 11. System Architecture

``` text
                    ┌──────────────────────┐
                    │    Farmer Interface  │
                    │ Chat / Dashboard     │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │   AI Coordinator     │
                    │ Agent Orchestrator   │
                    └──────────┬───────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
      ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
      │ Conflict     │ │ Mediation    │ │ Explanation  │
      │ Agent        │ │ Agent        │ │ Agent        │
      └──────┬───────┘ └──────┬───────┘ └──────────────┘
             │                │
             └────────┬───────┘
                      ▼
             ┌───────────────────┐
             │ Decision Engine   │
             │ Optimization      │
             │ Allocation        │
             └─────────┬─────────┘
                       │
             ┌─────────┴─────────┐
             ▼                   ▼
      ┌──────────────┐    ┌──────────────┐
      │ Rule /       │    │ Schedule     │
      │ Constraint   │    │ Generator    │
      │ Engine       │    │              │
      └──────┬───────┘    └──────┬───────┘
             │                   │
             └──────────┬────────┘
                        ▼
              ┌──────────────────┐
              │ Allocation JSON   │
              └────────┬─────────┘
                       │
                       ▼
              ┌──────────────────┐
              │ 3D Digital Twin  │
              │    Three.js      │
              └──────────────────┘
```

------------------------------------------------------------------------

# 12. Agent Roles

## 12.1 AI Coordinator

Responsible for orchestrating the workflow.

Example:

``` text
User reports dispute
        ↓
Coordinator identifies conflict
        ↓
Requests evidence
        ↓
Calls allocation engine
        ↓
Calls mediation agent
        ↓
Generates explanation
        ↓
Presents proposal
```

------------------------------------------------------------------------

## 12.2 Conflict Detection Agent

Identifies potential disputes.

It can look for:

-   allocation mismatch,
-   shortage,
-   overuse,
-   downstream deficit,
-   capacity violations,
-   abnormal water loss.

Example:

``` text
Expected tail-end availability = 7,000 L
Actual availability = 4,200 L

Difference = 2,800 L

Potential conflict detected.
```

------------------------------------------------------------------------

## 12.3 Water Allocation Engine

This should be deterministic code, not LLM reasoning.

It calculates:

-   total available water,
-   farmer requirements,
-   allocations,
-   deficits,
-   canal capacity,
-   losses,
-   priority constraints.

Example:

``` python
available_water = 50000

allocation = {
    "F01": 5000,
    "F02": 5000,
    "F03": 5000,
    "F04": 5000,
    "F05": 5000,
    "F06": 5000,
    "F07": 5000,
    "F08": 5000,
    "F09": 3000,
    "F10": 2000
}
```

The actual algorithm should be chosen according to the rules defined for
the prototype.

------------------------------------------------------------------------

# 13. Constraint Engine

The constraint engine validates every proposed allocation.

Possible constraints:

### Water Availability

``` text
Sum(all allocations) ≤ Available water
```

### Canal Capacity

``` text
Flow rate ≤ Canal capacity
```

### Farmer Requirement

``` text
Allocation ≤ Required water
```

### Minimum Fair Share

Where the rules define a minimum allocation:

``` text
Allocation ≥ Minimum allowed share
```

### Time Constraint

A farmer cannot receive water outside the assigned irrigation window.

### Infrastructure Constraint

A farmer can only receive water through an irrigation path that actually
reaches the farm.

------------------------------------------------------------------------

# 14. Fairness Model

Fairness should be explicit rather than hidden.

Potential factors:

-   land area,
-   crop water requirement,
-   current allocation,
-   actual water received,
-   upstream/downstream position,
-   historical allocation,
-   scarcity level,
-   agreed community rules.

The prototype should clearly state which factors are actually used.

Do not claim that an allocation is "fair" merely because an LLM says so.

Instead:

``` text
Fairness Score
      +
Constraint Satisfaction
      +
Water Availability
      +
Community Rules
      ↓
Recommended Allocation
```

------------------------------------------------------------------------

# 15. Mediation Agent

The mediation agent communicates the decision to farmers in
understandable language.

Example:

### Farmer

> "Why are you reducing my water? I have already received my normal
> allocation."

### Agent

``` text
Your current allocation is being reduced temporarily because
available canal water is 18% below the expected level.

The revised schedule ensures that the tail-end farmer receives
the minimum agreed allocation.

Your total irrigation duration will be reduced by 12 minutes,
and the next irrigation window is scheduled for 6:00 PM.
```

The agent should explain the decision without taking sides.

------------------------------------------------------------------------

# 16. Negotiation Workflow

The system should support objections.

Example:

``` text
Farmer F01:
"I cannot accept this. My crop will be damaged."

        ↓

Mediation Agent:
"Please provide your crop stage or updated water requirement."

        ↓

System:
Updates farmer requirement.

        ↓

Decision Engine:
Recalculates allocation.

        ↓

Constraint Engine:
Validates proposal.

        ↓

Mediation Agent:
Presents revised schedule.

        ↓

Farmer:
Accept / Reject / Request Revision
```

This demonstrates that the system is genuinely **agentic** rather than a
simple question-answering chatbot.

------------------------------------------------------------------------

# 17. Schedule Generation

Instead of only returning litres, the system should generate a usable
irrigation schedule.

Example:

  Farmer     Start     End   Duration   Allocation
  -------- ------- ------- ---------- ------------
  F01        06:00   06:20     20 min      5,000 L
  F02        06:20   06:40     20 min      5,000 L
  F03        06:40   07:00     20 min      5,000 L
  ...          ...     ...        ...          ...
  F10        09:00   09:30     30 min      7,000 L

The actual values should be generated by the prototype's allocation
engine rather than hard-coded into the UI.

------------------------------------------------------------------------

# 18. Farmer Interface

The interface should be simple enough for a farmer.

Possible screens:

## Dashboard

``` text
Today's Water Status

Available Water: 50,000 L
Demand: 63,000 L
Scarcity: 20.6%

Your Allocation: 7,000 L
Scheduled Time: 08:30–09:00
```

## Ask the Mediator

``` text
Farmer:
"Why did my water reduce?"
```

The agent responds with the evidence and reasoning.

## Object

``` text
[ Object to Allocation ]
```

The system starts a negotiation workflow.

------------------------------------------------------------------------

# 19. Evidence / Glass-Box Explanation

A major differentiator should be transparent decision explanation.

Instead of:

> "The AI decided this allocation."

Show:

``` text
WHY WAS F10 GIVEN 7,000 L?

✓ Available water: 50,000 L
✓ F10 requirement: 9,000 L
✓ Previous received water: 4,200 L
✓ Tail-end deficit detected
✓ Canal capacity respected
✓ Minimum agreed share respected
✓ Total allocation ≤ available water

Recommendation:
Allocate 7,000 L to F10.
```

The user should be able to inspect the evidence behind the
recommendation.

------------------------------------------------------------------------

# 20. Agreement Record

Once farmers accept the proposal, create an agreement record.

Example:

``` json
{
  "agreement_id": "AGR-2026-001",
  "status": "accepted",
  "participants": [
    "F01",
    "F02",
    "F10"
  ],
  "allocation": {
    "F01": 4500,
    "F02": 4500,
    "F10": 7000
  },
  "reason": "Tail-end shortage correction",
  "created_at": "2026-09-11T10:30:00"
}
```

The record should be immutable or versioned in the prototype.

If a proposal changes:

``` text
Version 1 → Version 2 → Version 3
```

This creates an audit trail.

------------------------------------------------------------------------

# 21. Data Flow

``` text
Farmer Complaint
      ↓
Structured Conflict
      ↓
Collect Available Evidence
      ↓
Calculate Current Water State
      ↓
Detect Constraint Violations
      ↓
Run Allocation Engine
      ↓
Generate Candidate Schedule
      ↓
Validate Constraints
      ↓
Mediation Agent Explains Proposal
      ↓
Farmer Objection?
   ┌──┴──┐
  YES    NO
   │      │
   ▼      ▼
Recalculate   Agreement
   │
   ▼
New Proposal
```

------------------------------------------------------------------------

# 22. Prototype Data

For a 24-hour hackathon, do not depend on real sensors or drones.

Create a synthetic dataset containing:

-   10 farmers,
-   farm areas,
-   crop types,
-   crop water requirements,
-   canal positions,
-   farmer locations,
-   allocation rules,
-   available water,
-   actual water received,
-   flow rates,
-   canal capacities,
-   potential losses,
-   irrigation schedules.

The UI should make it clear that this is a **prototype simulation**.

------------------------------------------------------------------------

# 23. Real-World Deployment Path

The prototype can later accept real-world data.

Potential sources include:

``` text
GIS
 │
 ├── Canal network
 ├── Farm boundaries
 ├── Field channels
 └── Elevation
        ↓
Drone Surveys
        ↓
Water Flow Sensors
        ↓
Community Measurements
        ↓
Farmer Reports
        ↓
Historical Water Records
        ↓
AI Mediation Platform
```

Drone/GIS mapping could help identify actual field channels, command
areas, blockages, structural damage, and discrepancies between official
maps and ground reality.

For the hackathon, these should be represented as future integration
points unless actual datasets are available.

------------------------------------------------------------------------

# 24. Three.js Digital Twin Architecture

Possible frontend structure:

``` text
React / Next.js
      │
      ├── Dashboard UI
      ├── Farmer Panel
      ├── Mediation Chat
      ├── Allocation Table
      └── Three.js Scene
              │
              ├── Dam
              ├── Water
              ├── Canal
              ├── Farms
              ├── Terrain
              ├── Farmer Markers
              └── Flow Animation
```

The 3D layer should consume allocation/state JSON.

Example:

``` json
{
  "water_level": 72,
  "canal_flow": 420,
  "farmers": [
    {
      "id": "F01",
      "allocation": 5000,
      "received": 5000,
      "status": "normal"
    },
    {
      "id": "F10",
      "allocation": 7000,
      "received": 4200,
      "status": "conflict"
    }
  ]
}
```

------------------------------------------------------------------------

# 25. Suggested Technology Stack

## Frontend

-   Next.js
-   TypeScript
-   React
-   Three.js
-   React Three Fiber
-   Tailwind CSS
-   shadcn/ui

## Backend

-   Node.js
-   Express.js or Next.js API routes

## Database

Possible options:

-   PostgreSQL
-   MongoDB

For the hackathon, PostgreSQL is useful if structured relational data
and audit history are important.

## AI

Use an LLM for:

-   natural-language understanding,
-   mediation,
-   negotiation,
-   explanations,
-   converting farmer messages into structured requests,
-   summarizing agreements.

## Deterministic Backend

Use normal code for:

-   calculations,
-   constraints,
-   allocation,
-   optimization,
-   schedule generation,
-   validation.

------------------------------------------------------------------------

# 26. LLM Cost Management

A judge may ask:

> "Won't calling an LLM for every interaction become expensive?"

The answer should go beyond simple caching.

## Strategy

### 1. Use LLM only where reasoning/language is required

Do not call the LLM for:

-   arithmetic,
-   water balance,
-   allocation calculations,
-   constraint validation,
-   database queries,
-   3D rendering.

### 2. Deterministic decision engine

Perform numerical optimization in backend code.

### 3. Structured outputs

Send compact JSON rather than large conversation histories.

### 4. Memory summarization

Instead of sending every historical interaction, maintain structured
farmer state and summarized context.

### 5. Semantic caching

Repeated questions with equivalent intent can reuse an existing response
where appropriate.

### 6. Model routing

Use a smaller/cheaper model for:

-   classification,
-   intent detection,
-   extraction.

Use a stronger model only for:

-   complex mediation,
-   negotiation,
-   difficult explanations.

### 7. Event-driven calls

Only invoke the agent when an event actually requires mediation.

Example:

``` text
Normal water distribution
        ↓
No LLM required

Conflict detected
        ↓
LLM mediation required
```

This can make the system substantially cheaper than an architecture
where every interaction calls a large model.

------------------------------------------------------------------------

# 27. Why This Is Agentic AI

The system should not be presented as:

> "We made a chatbot for farmers."

Instead:

> "We built an autonomous mediation workflow where AI agents interpret
> farmer requests, identify conflicts, invoke deterministic allocation
> and constraint engines, negotiate with stakeholders, generate revised
> proposals, explain decisions, and maintain an auditable agreement."

Agentic characteristics:

-   observes,
-   reasons,
-   calls tools,
-   evaluates constraints,
-   takes an action,
-   receives feedback,
-   revises the plan,
-   records the outcome.

------------------------------------------------------------------------

# 28. RAG

If RAG is included:

**R = Retrieval**

**A = Augmented**

**G = Generation**

RAG can provide the mediation agent with relevant rules and community
policies.

Example:

``` text
Farmer dispute
      ↓
Retrieve relevant water-sharing rules
      ↓
Add rules to agent context
      ↓
Agent generates explanation/proposal
```

Potential knowledge base:

-   community water-sharing rules,
-   irrigation schedules,
-   WUCS policies,
-   crop guidelines,
-   approved allocation principles,
-   local dispute-resolution procedures.

RAG should provide the **policy/context**.

The deterministic engine should still enforce numerical constraints.

------------------------------------------------------------------------

# 29. Important Architecture Principle

Do not put everything inside the LLM.

Bad architecture:

``` text
Farmer → LLM → Allocation
```

Better architecture:

``` text
Farmer
   ↓
LLM / Agent
   ↓
Tools
   ├── Water Data
   ├── Rule Engine
   ├── Allocation Engine
   ├── Schedule Generator
   └── Agreement Database
   ↓
LLM / Mediation
   ↓
Farmer
```

The LLM is the **orchestrator and communication layer**, not the source
of truth for numerical decisions.

------------------------------------------------------------------------

# 30. Strong Hackathon Demo Flow

## Step 1 --- Show the 3D World

Start with:

``` text
DAM
 ↓
CANAL
 ↓
10 FARMS
```

Show flowing water.

Say:

> "This is our synthetic digital twin of an irrigation network."

------------------------------------------------------------------------

## Step 2 --- Introduce Scarcity

Show:

``` text
Available Water: 50,000 L
Total Demand: 63,000 L
```

The system identifies scarcity.

------------------------------------------------------------------------

## Step 3 --- Detect Conflict

Show:

``` text
F10 — Tail-End Farmer

Required: 9,000 L
Received: 4,200 L

⚠ Conflict detected
```

------------------------------------------------------------------------

## Step 4 --- Ask the Agent

User:

> "Resolve this water-sharing dispute fairly."

The AI Coordinator starts the workflow.

------------------------------------------------------------------------

## Step 5 --- Show Evidence

Display:

``` text
Tail-end deficit
Canal capacity
Upstream allocations
Actual flow
Available water
Community rules
```

------------------------------------------------------------------------

## Step 6 --- Run Decision Engine

The deterministic engine calculates a new allocation.

------------------------------------------------------------------------

## Step 7 --- Update the 3D Map

The water-flow visualization changes.

Farmer allocations update.

F10 changes from:

``` text
4,200 L
```

to:

``` text
7,000 L
```

------------------------------------------------------------------------

## Step 8 --- Farmer Objects

User switches to F01:

> "Why are you reducing my water?"

The mediation agent explains the trade-off.

------------------------------------------------------------------------

## Step 9 --- Revise

Farmer provides additional information.

The system recalculates.

------------------------------------------------------------------------

## Step 10 --- Agreement

The farmers accept the final schedule.

The system creates:

``` text
Agreement ID
Allocation
Schedule
Reason
Participants
Evidence
Timestamp
Version
```

------------------------------------------------------------------------

# 31. Judge-Facing Explanation

If judges ask:

### "What is the AI actually doing?"

Answer:

> "The AI is not directly calculating litres. It interprets farmer
> requests, coordinates the mediation workflow, retrieves applicable
> rules, calls deterministic allocation and constraint tools, explains
> the resulting decision, handles objections, and coordinates
> revisions."

------------------------------------------------------------------------

### "How do you know the AI isn't making up the allocation?"

Answer:

> "The allocation is generated and validated by deterministic backend
> logic. The LLM cannot directly override water-balance and constraint
> checks."

------------------------------------------------------------------------

### "How do you handle fairness?"

Answer:

> "We make the fairness criteria explicit---such as water availability,
> crop requirement, current deficit, network position and
> community-defined rules---and use those criteria inside the decision
> engine rather than asking the LLM to subjectively decide what is
> fair."

------------------------------------------------------------------------

### "Where does the data come from?"

Answer:

> "Our hackathon prototype uses synthetic irrigation data. In a real
> deployment, the same data model could ingest GIS or drone mapping,
> flow measurements, farmer reports and community water records."

------------------------------------------------------------------------

### "Why the 3D map?"

Answer:

> "The 3D digital twin makes the physical cause of the dispute visible.
> Instead of showing only a table saying that F10 has a shortage, judges
> can see the dam, canal network, farmer positions, water flow and the
> affected tail-end area. The visualization is directly connected to the
> allocation engine."

------------------------------------------------------------------------

### "What happens if a farmer disagrees?"

Answer:

> "The system does not simply force the allocation. The farmer can
> object, the mediation agent captures the objection, the relevant state
> can be updated, the deterministic engine recalculates the proposal,
> and the new version is validated before being presented."

------------------------------------------------------------------------

# 32. Key Differentiators

## 1. Agentic Negotiation

The system can negotiate rather than only answer questions.

## 2. Constraint-Based Reasoning

Hard constraints are enforced by software.

## 3. Fairness-Aware Allocation

Fairness criteria are explicit.

## 4. Digital Twin

The irrigation network is visualized in 3D.

## 5. Glass-Box Decisions

Farmers can see why an allocation was recommended.

## 6. Human-in-the-Loop

Farmers can object and provide additional information.

## 7. Auditability

Agreements and revisions are recorded.

## 8. Real-World Deployment Path

The synthetic prototype can eventually integrate GIS, drone surveys,
sensors and community data.

------------------------------------------------------------------------

# 33. What NOT to Claim

Do not claim:

-   that the prototype has real drone data if it does not,
-   that the system physically controls irrigation infrastructure,
-   that the AI can independently determine truth without evidence,
-   that the LLM performs reliable numerical optimization,
-   that every dispute can automatically be solved,
-   that the system replaces community governance,
-   that the prototype has real-time sensor data unless it actually
    does.

Instead say:

> "The prototype demonstrates the software and agentic workflow using
> synthetic data. The architecture is designed so real-world GIS, field
> measurements and sensor data can be integrated later."

------------------------------------------------------------------------

# 34. 24-Hour Hackathon Scope

## Must Have

-   3D irrigation map
-   dam
-   canal
-   farms
-   animated water flow
-   10 farmers
-   synthetic water dataset
-   conflict detection
-   allocation engine
-   constraint validation
-   mediation chat
-   objection/revision workflow
-   before/after visualization
-   explanation panel
-   agreement/audit record

## Nice to Have

-   RAG
-   terrain/elevation
-   animated irrigation schedule
-   fairness score
-   historical dispute timeline
-   farmer profiles
-   richer analytics

## Avoid if Time Is Limited

-   real drone integration
-   real IoT sensors
-   complicated computer vision
-   complex satellite processing
-   over-engineered multi-agent frameworks
-   fully autonomous physical irrigation control

------------------------------------------------------------------------

# 35. Recommended MVP

The strongest MVP is:

``` text
             ┌──────────────────────────┐
             │       3D DIGITAL TWIN    │
             │                          │
             │  DAM → CANAL → 10 FARMS  │
             │        💧💧💧             │
             └────────────┬─────────────┘
                          │
                          ▼
                  Conflict Detected
                          │
                          ▼
                  AI MEDIATOR
                          │
             ┌────────────┴────────────┐
             ▼                         ▼
      Allocation Engine         Rule Engine
             │                         │
             └────────────┬────────────┘
                          ▼
                   New Schedule
                          │
                          ▼
                 Farmer Objection?
                     /          \
                   YES           NO
                    │             │
                    ▼             ▼
               Recalculate    Agreement
                    │             │
                    └──────┬──────┘
                           ▼
                     Audit Record
```

------------------------------------------------------------------------

# 36. One-Line Pitch

> **"An AI-powered digital mediator that uses water-network data,
> deterministic allocation, constraint reasoning and agentic negotiation
> to resolve irrigation water disputes fairly and transparently."**

------------------------------------------------------------------------

# 37. 30-Second Pitch

> "Farmers often face disputes when limited irrigation water has to be
> shared across upstream and downstream farms. Our system creates a
> digital twin of the irrigation network and combines it with an agentic
> mediation system. When a conflict occurs, the AI gathers the relevant
> evidence, invokes a deterministic water-allocation and constraint
> engine, generates a feasible schedule, explains the trade-offs to
> farmers, handles objections, and revises the proposal when necessary.
> Every final agreement is recorded for transparency and auditability.
> Our prototype uses synthetic data, while the architecture can later
> integrate GIS, drone mapping, field measurements and sensors."

------------------------------------------------------------------------

# 38. Final Product Vision

The long-term system can evolve into:

``` text
              COMMUNITY WATER GOVERNANCE
                         │
          ┌──────────────┼──────────────┐
          │              │              │
        FARMERS        WUCS        COMMUNITY
          │              │          HYDROLOGISTS
          └──────────────┼──────────────┘
                         │
                         ▼
              WATER GOVERNANCE PLATFORM
                         │
       ┌─────────────────┼──────────────────┐
       │                 │                  │
      GIS             SENSORS            RECORDS
       │                 │                  │
       └─────────────────┼──────────────────┘
                         ▼
                  DIGITAL TWIN
                         │
                         ▼
                AI MEDIATION LAYER
                         │
             ┌───────────┼───────────┐
             │           │           │
          Conflict    Allocation   Negotiation
          Detection     Engine       Agent
             │           │           │
             └───────────┼───────────┘
                         ▼
                  FAIR SCHEDULE
                         │
                         ▼
                  HUMAN AGREEMENT
                         │
                         ▼
                   AUDIT RECORD
```

The central philosophy is:

> **Use AI for coordination, communication and negotiation; use
> deterministic systems for facts, calculations and constraints; use
> transparent evidence to keep humans in control.**
