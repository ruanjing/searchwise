const GrowthVaultConstants = (() => {
  const STORAGE_KEYS = {
    PROJECTS: 'growthvault_projects',
    CLIPS: 'growthvault_clips',
    PENDING_DRAFTS: 'growthvault_pending_drafts'
  };

  const MATERIAL_TYPES = [
    { id: 'competitor', label: 'Competitor' },
    { id: 'value_proposition', label: 'Value Proposition' },
    { id: 'pain_point', label: 'Pain Point' },
    { id: 'user_comment', label: 'User Comment' },
    { id: 'pricing', label: 'Pricing' },
    { id: 'title', label: 'Title' },
    { id: 'channel_example', label: 'Channel Example' },
    { id: 'idea', label: 'Idea' }
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
