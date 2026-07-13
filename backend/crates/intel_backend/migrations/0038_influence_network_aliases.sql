-- Add search-only aliases while preserving canonical network and FEC committee identities.
ALTER TABLE influence_networks
    ADD COLUMN IF NOT EXISTS aliases TEXT[] NOT NULL DEFAULT '{}';

UPDATE influence_networks
SET aliases = CASE network_slug
    WHEN 'aipac' THEN ARRAY['AIPAC', 'American Israel Public Affairs Committee', 'United Democracy Project', 'UDP']
    WHEN 'nra' THEN ARRAY['NRA', 'National Rifle Association', 'NRA Political Victory Fund']
    WHEN 'planned-parenthood' THEN ARRAY['Planned Parenthood', 'Planned Parenthood Action Fund']
    WHEN 'afl-cio' THEN ARRAY['AFL-CIO', 'COPE', 'Committee on Political Education']
    WHEN 'chamber-of-commerce' THEN ARRAY['US Chamber', 'U.S. Chamber of Commerce', 'Chamber of Commerce']
    WHEN 'koch-network' THEN ARRAY['Koch Network', 'Americans for Prosperity', 'AFP Action']
    WHEN 'emilys-list' THEN ARRAY['EMILY''s List', 'EMILYS List']
    WHEN 'club-for-growth' THEN ARRAY['Club for Growth', 'Club for Growth Action']
    WHEN 'lcv' THEN ARRAY['LCV', 'League of Conservation Voters', 'LCV Action Fund']
    WHEN 'nar' THEN ARRAY['NAR', 'National Association of Realtors', 'RPAC']
    WHEN 'ama' THEN ARRAY['AMA', 'American Medical Association', 'AMPAC']
    WHEN 'sierra-club' THEN ARRAY['Sierra Club', 'Sierra Club Political Committee']
    WHEN 'nrlc' THEN ARRAY['NRLC', 'National Right to Life']
    ELSE aliases
END;
