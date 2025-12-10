> system: “You can only answer based on the provided mission context. If you do not know, say you are unsure.”

Good questions are:

* “Explain / summarize / extract / rephrase what is in the mission”
* “Identify risks, assumptions, dependencies described in the mission”
* “Turn this mission into steps, checklists, stories, or plans”
* “Compare options that are already implied by the mission text”

Bad questions are:

* “What is Vault?” if the mission does not explain it
* “How does Couchbase work internally?”
* “What is HashiCorp’s stock price?”

Those require external knowledge that the agent has no context for.

---

### 1. Generic question patterns that work well

These all stay inside the mission text:

**Summarise and clarify**

* “Give me a three sentence summary of this mission for a CxO.”
* “Rewrite this mission for a junior engineer who is new to Vault.”
* “What are the main goals described in this mission?”
* “What is explicitly out of scope in this mission, based on the text?”

**Risks, assumptions, dependencies**

* “List the key risks mentioned or implied by this mission.”
* “What assumptions does this mission make about the environment or team?”
* “Which dependencies would you track for this mission and why?”
* “If this mission fails, what are the most likely failure modes according to the text?”

**Planning and sequencing**

* “Turn this mission into a numbered implementation plan.”
* “Group the mission into phases and describe each phase.”
* “What should be done first, next, and last according to this mission?”
* “Which steps could run in parallel and which must be sequential?”

**Roles, stakeholders, impact**

* “Who are the main stakeholders mentioned or implied here?”
* “What is the impact of this mission on platform teams vs app teams?”
* “From the mission, what would you highlight in a status update to leadership?”

**Transformation / reformatting**

* “Turn this mission into a checklist with tick boxes.”
* “Produce a one-slide bullet list for a presentation, based only on this mission.”
* “Rewrite this mission as user stories with ‘As a … I want … so that …’.”

**Validation and consistency**

* “Does this mission contain any conflicting goals? If yes, which ones?”
* “Which parts of this mission are vague and should be clarified?”
* “Based on this text only, is the mission more about discovery or implementation?”

---

### 2. Concrete examples for your current missions

You have missions like:

* `Dynamic creds mission`
* `Rotation test mission`
* `Failover and grace window`
* `Agentic trust bootstrap`
* `Explore life at HashiCorp`

You can ask mission-specific things like:

**For “Dynamic creds mission”**

* “Explain how dynamic credentials are used in this mission.”
* “What problems is this mission trying to solve with dynamic credentials?”
* “List the steps in this mission that involve Vault.”
* “What could go wrong if the dynamic credentials do not rotate as described?”

**For “Rotation test mission”**

* “Summarise how credential rotation is supposed to work in this mission.”
* “What is being tested here: correctness, resilience, or alerting?”
* “Which signals or metrics are mentioned or implied to validate rotation?”
* “What happens according to the text when rotation fails mid-mission?”

**For “Failover and grace window”**

* “Explain how the grace window works for this mission.”
* “What user experience are we trying to preserve during failover?”
* “Which conditions trigger the grace period according to the mission?”
* “How would you describe this failover story to a non-technical stakeholder?”

**For “Agentic trust bootstrap”**

* “What are the main components involved in this bootstrap mission?”
* “How does this mission define ‘trust’ in the context of the stack?”
* “What needs to be provisioned before this mission can start?”
* “If this mission is successful, what changes in the environment?”

**For “Explore life at HashiCorp”**

* “What aspects of ‘life at HashiCorp’ does this mission focus on?”
* “How does this mission propose to explore or demonstrate those aspects?”
* “Turn this mission into three demo ideas that match the described goals.”