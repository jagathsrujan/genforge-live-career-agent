/**
 * Safe GenForge Pi extension.
 *
 * The extension is a capability manifest for Pi's restricted runtime. It does
 * not execute file, network, browser, or export work itself. Server-owned
 * adapters perform those actions after validation; these tools are intentionally
 * not used as an unrestricted agent toolbox.
 */
export default function genforgeExtension(pi) {
  const tools = [
    ["extract_document", "Extract structured text from a user-provided resume, certificate, or export."],
    ["analyze_image_source", "Analyze a user-provided screenshot or photo source with explicit provenance."],
    ["research_public_source", "Summarize an already safety-checked public URL using reconciled observations."],
    ["search_job_market", "Find public job leads only when a user-provided company or job URL exists."],
    ["reconcile_research", "Deduplicate and reconcile source-backed observations without inventing facts."],
    ["analyze_job_requirements", "Turn a job description into transparent, labeled requirements."],
    ["draft_resume", "Draft resume wording from approved evidence only."],
    ["validate_resume", "Run factuality and deterministic resume checks."],
  ];

  for (const [name, description] of tools) {
    pi.registerTool({
      name,
      label: `GenForge: ${name}`,
      description,
      parameters: { type: "object", properties: { input: { type: "string" } }, required: ["input"] },
      async execute(_toolCallId, params) {
        return { content: [{ type: "text", text: JSON.stringify({ tool: name, delegated: true, message: "GenForge server adapters own this capability; Pi may only return structured analysis." }) }], details: {} };
      },
    });
  }
}
