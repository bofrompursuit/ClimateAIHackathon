# ThreadTrace.io hackathon demo

ThreadTrace.io demonstrates how item-level apparel take-back records can be normalized, evaluated against illustrative California eligibility rules, and exported with an audit decision trail.

## Try the demo

Open `index.html` in a browser. Select **Upload sample batch**, inspect a row to see its source payload and applied rules, then select **Download prototype CSV**. You can also import the files in `sample-data/`.

The floating **ThreadTrace.io Audit Guide** answers batch, reason, recovery, data-quality, weight, and modeled-credit questions in short points. The dashboard publishes evaluated batch context; the rule-based guide reads it and never changes eligibility. Its seven suggested questions use the currently loaded batch. There is no live LLM.

The included modeled batch has 2,500 mocked ThredUp-style items, including the original 16 demonstration records. The table supports filtering, sorting, and 50-item pages. Generate the fixtures again with `node generate-sample-batch.js`. The prototype checks California donor origin, resale or repair disposition, and item weight. Missing weights use a category benchmark and a 10% buffer. The dashboard shows eligible weight, modeled credit, and rejection counts by reason.

The $0.75/kg credit and eligibility rules are demonstration assumptions. The CSV is a **prototype export format**, not a Landbell or CalRecycle filing schema. This is not a production filing or legal-compliance system.

Production integrations, official schema validation, security and retention controls, reconciliation, cryptographic hashing, configurable rule administration, and legal validation are outside this demo's scope.
