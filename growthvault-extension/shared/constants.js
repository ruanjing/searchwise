const GrowthVaultConstants = (() => {
  const STORAGE_KEYS = {
    PROJECTS: 'growthvault_projects',
    CLIPS: 'growthvault_clips',
    PENDING_DRAFTS: 'growthvault_pending_drafts'
  };

  const MATERIAL_TYPES = [
    { id: 'competitor', label: (typeof chrome !== 'undefined' && chrome.i18n) ? chrome.i18n.getMessage('typeCompetitor') || 'Competitor' : 'Competitor' },
    { id: 'value_proposition', label: (typeof chrome !== 'undefined' && chrome.i18n) ? chrome.i18n.getMessage('typeValueProposition') || 'Value Proposition' : 'Value Proposition' },
    { id: 'pain_point', label: (typeof chrome !== 'undefined' && chrome.i18n) ? chrome.i18n.getMessage('typePainPoint') || 'Pain Point' : 'Pain Point' },
    { id: 'user_comment', label: (typeof chrome !== 'undefined' && chrome.i18n) ? chrome.i18n.getMessage('typeUserComment') || 'User Comment' : 'User Comment' },
    { id: 'pricing', label: (typeof chrome !== 'undefined' && chrome.i18n) ? chrome.i18n.getMessage('typePricing') || 'Pricing' : 'Pricing' },
    { id: 'title', label: (typeof chrome !== 'undefined' && chrome.i18n) ? chrome.i18n.getMessage('typeTitle') || 'Title' : 'Title' },
    { id: 'channel_example', label: (typeof chrome !== 'undefined' && chrome.i18n) ? chrome.i18n.getMessage('typeChannelExample') || 'Channel Example' : 'Channel Example' },
    { id: 'idea', label: (typeof chrome !== 'undefined' && chrome.i18n) ? chrome.i18n.getMessage('typeIdea') || 'Idea' : 'Idea' }
  ];

  const DEFAULT_PROJECT_NAME = 'Inbox';
  const MAX_CLIP_TEXT_LENGTH = 10000;

  return {
    STORAGE_KEYS,
    MATERIAL_TYPES,
    DEFAULT_PROJECT_NAME,
    MAX_CLIP_TEXT_LENGTH
  };
})();
