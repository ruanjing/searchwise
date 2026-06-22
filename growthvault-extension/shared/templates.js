const GrowthVaultTemplates = (() => {
  const TEMPLATES = [
    { id: 'competitor_analysis', name: (typeof chrome !== 'undefined' && chrome.i18n) ? chrome.i18n.getMessage('templateCompetitorAnalysis') || 'Competitor analysis summary' : 'Competitor analysis summary' },
    { id: 'launch_post', name: (typeof chrome !== 'undefined' && chrome.i18n) ? chrome.i18n.getMessage('templateLaunchPost') || 'Launch post draft' : 'Launch post draft' },
    { id: 'landing_page_value_props', name: (typeof chrome !== 'undefined' && chrome.i18n) ? chrome.i18n.getMessage('templateLandingPage') || 'Landing page value proposition list' : 'Landing page value proposition list' },
    { id: 'pain_point_list', name: (typeof chrome !== 'undefined' && chrome.i18n) ? chrome.i18n.getMessage('templatePainPointList') || 'User pain point list' : 'User pain point list' }
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

  function renderCustomTemplate(content, projectName, clips) {
    let output = content || '';
    // Replace {{projectName}}
    output = output.replace(/\{\{\s*projectName\s*\}\}/g, projectName);

    // Find and replace all placeholders of format {{placeholder}}
    const matches = output.match(/\{\{\s*[a-zA-Z0-9_-]+\s*\}\}/g) || [];
    const replaced = new Set();

    for (const match of matches) {
      if (replaced.has(match)) continue;
      replaced.add(match);
      
      const typeId = match.replace(/\{\{\s*/, '').replace(/\s*\}\}/, '');
      if (typeId === 'projectName') continue;
      
      if (typeId === 'allClips') {
        const lines = clips.map(clipLine).join('\n');
        output = output.replaceAll(match, lines || '- No saved material yet.');
      } else {
        const filtered = clipsOf(clips, [typeId]);
        const lines = filtered.map(clipLine).join('\n');
        output = output.replaceAll(match, lines || '- No saved material yet.');
      }
    }
    return output;
  }

  function renderTemplate(templateId, options = {}) {
    const { projectName, clips, customTemplates } = options || {};
    const safeName = projectName || 'Untitled Project';
    const safeClips = Array.isArray(clips) ? clips : [];
    if (templateId === 'competitor_analysis') return renderCompetitorAnalysis(safeName, safeClips);
    if (templateId === 'launch_post') return renderLaunchPost(safeName, safeClips);
    if (templateId === 'landing_page_value_props') return renderLandingPage(safeName, safeClips);
    if (templateId === 'pain_point_list') return renderPainPoints(safeName, safeClips);
    
    // Check if it's a custom template
    if (Array.isArray(customTemplates)) {
      const found = customTemplates.find(t => t.id === templateId);
      if (found) {
        return renderCustomTemplate(found.content, safeName, safeClips);
      }
    }
    throw new Error(`Unknown template: ${templateId}`);
  }

  return {
    TEMPLATES,
    renderTemplate
  };
})();
