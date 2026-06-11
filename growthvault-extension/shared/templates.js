const GrowthVaultTemplates = (() => {
  const TEMPLATES = [
    { id: 'competitor_analysis', name: 'Competitor analysis summary' },
    { id: 'launch_post', name: 'Launch post draft' },
    { id: 'landing_page_value_props', name: 'Landing page value proposition list' },
    { id: 'pain_point_list', name: 'User pain point list' }
  ];

  function clipLine(clip) {
    const text = clip.text || clip.title || 'Untitled saved material';
    const note = clip.note ? ` (${clip.note})` : '';
    const source = clip.url ? `\n  Source: ${clip.url}` : '';
    return `- ${text}${note}${source}`;
  }

  function clipsOf(clips, types) {
    const wanted = new Set(types);
    return clips.filter((clip) => wanted.has(clip.type));
  }

  function section(title, clips) {
    if (!clips.length) return `## ${title}\n\n- No saved material yet.\n`;
    return `## ${title}\n\n${clips.map(clipLine).join('\n')}\n`;
  }

  function renderCompetitorAnalysis(projectName, clips) {
    return [
      `# Competitor Analysis: ${projectName}`,
      section('Competitor Signals', clipsOf(clips, ['competitor', 'pricing', 'channel_example'])),
      section('Value Propositions', clipsOf(clips, ['value_proposition', 'title'])),
      section('User Pain Points', clipsOf(clips, ['pain_point', 'user_comment'])),
      section('Ideas To Test', clipsOf(clips, ['idea']))
    ].join('\n');
  }

  function renderLaunchPost(projectName, clips) {
    return [
      `# Launch Post Draft: ${projectName}`,
      section('Hook Ideas', clipsOf(clips, ['title', 'pain_point', 'user_comment'])),
      section('Product Promise', clipsOf(clips, ['value_proposition', 'idea'])),
      section('Proof And Context', clipsOf(clips, ['competitor', 'channel_example', 'pricing'])),
      '## Draft Notes\n\n- Combine the strongest pain point with one clear product promise.\n- Keep one source link nearby for credibility.\n'
    ].join('\n');
  }

  function renderLandingPage(projectName, clips) {
    return [
      `# Landing Page Value Props: ${projectName}`,
      section('Primary Value Props', clipsOf(clips, ['value_proposition'])),
      section('Pain Points To Address', clipsOf(clips, ['pain_point', 'user_comment'])),
      section('Competitive Angles', clipsOf(clips, ['competitor', 'pricing'])),
      section('Headline Ideas', clipsOf(clips, ['title', 'idea']))
    ].join('\n');
  }

  function renderPainPoints(projectName, clips) {
    return [
      `# User Pain Points: ${projectName}`,
      section('Direct Pain Points', clipsOf(clips, ['pain_point', 'user_comment'])),
      section('Supporting Context', clipsOf(clips, ['competitor', 'channel_example', 'pricing', 'idea']))
    ].join('\n');
  }

  function renderTemplate(templateId, { projectName, clips } = {}) {
    const safeName = projectName || 'Untitled Project';
    const safeClips = Array.isArray(clips) ? clips : [];
    if (templateId === 'competitor_analysis') return renderCompetitorAnalysis(safeName, safeClips);
    if (templateId === 'launch_post') return renderLaunchPost(safeName, safeClips);
    if (templateId === 'landing_page_value_props') return renderLandingPage(safeName, safeClips);
    if (templateId === 'pain_point_list') return renderPainPoints(safeName, safeClips);
    throw new Error(`Unknown template: ${templateId}`);
  }

  return {
    TEMPLATES,
    renderTemplate
  };
})();
