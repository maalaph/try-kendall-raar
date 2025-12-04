# RAAR Voice Library Curation Guide

This guide will help you build a comprehensive voice library by manually adding diverse voices from ElevenLabs global library to your "My Voices" account. Once added, these voices become permanently available via API and can be used in RAAR's voice matching system.

## Why Manual Curation?

ElevenLabs has two separate voice systems:
- **Global Voice Library (5000+ voices)**: Can only be browsed in UI, not accessible via API
- **"My Voices" (Your Account)**: Fully accessible via API, permanent access

By manually adding voices to "My Voices", they become:
- ✅ Permanently available via API
- ✅ Accessible to RAAR's voice matching system
- ✅ Available even if original creator deletes them
- ✅ Full commercial rights (as allowed by license)

## Step-by-Step: Adding Voices to "My Voices"

### Step 1: Access ElevenLabs Voice Library
1. Go to [ElevenLabs Voice Library](https://elevenlabs.io/voice-library)
2. Log in to your ElevenLabs account (Creator plan or higher required)
3. Browse the global voice library

### Step 2: Find and Preview Voices
1. Use filters to find voices by:
   - Gender (Male, Female, Neutral)
   - Accent (American, British, African-American, etc.)
   - Age (Young, Middle-aged, Older)
   - Characteristics (Deep, Raspy, Calm, etc.)
2. Click on voices to preview them
3. Listen to sample audio to verify quality

### Step 3: Add to "My Voices"
1. When you find a voice you want to add:
   - Click the **"Choose"** button (or "Add to My Voices" button)
   - The voice will be added to your "My Voices" collection
2. Repeat for all voices you want to curate
3. Target: **50-100 diverse voices** for comprehensive coverage

### Step 4: Verify in API
- Voices added to "My Voices" will automatically appear in RAAR's voice library
- The system syncs voices from "My Voices" via `/v1/voices` API endpoint
- No additional configuration needed - they're automatically available

## Recommended Voice Combinations to Curate

### High Priority (Add First)

#### Age + Gender + Accent Combinations
- ✅ Older male African-American
- ✅ Middle-aged female British
- ✅ Young male American
- ✅ Older female American
- ✅ Middle-aged male Indian-American
- ✅ Young female American
- ✅ Middle-aged male Mexican-American
- ✅ Older male British
- ✅ Middle-aged female American
- ✅ Young male Asian-American

#### Voice Characteristics
- ✅ Deep male voices (for authoritative, mature sounds)
- ✅ Raspy male voices (for unique, distinctive sounds)
- ✅ Calm female voices (for soothing, professional sounds)
- ✅ Professional male/female (for business contexts)
- ✅ Warm male/female (for friendly, approachable sounds)
- ✅ Energetic voices (for upbeat, lively content)
- ✅ Smooth voices (for polished, refined content)

#### Character Types
- ✅ Musician voices (for music-related content)
- ✅ Narrator voices (for storytelling, audiobooks)
- ✅ Radio host voices (for broadcast-style content)
- ✅ Podcast voices (for conversational, engaging content)
- ✅ Teacher voices (for educational content)
- ✅ Professional/Corporate voices (for business content)

### Medium Priority

#### Additional Accent Combinations
- Southern American
- Northern American
- Australian
- Canadian
- Spanish
- French
- German
- Italian
- Arabic
- Asian (various)

#### Age Variations
- Young voices (18-30)
- Middle-aged voices (30-50)
- Older voices (50+)

#### Tone Variations
- Energetic
- Calm
- Professional
- Casual
- Authoritative
- Friendly

## Voice Selection Tips

### What Makes a Good Voice for RAAR?
1. **Clear and Natural**: Easy to understand, natural-sounding
2. **Versatile**: Works for various use cases
3. **Distinctive**: Has unique characteristics but not too niche
4. **Professional**: Appropriate for business contexts
5. **Diverse**: Covers different demographics and accents

### What to Avoid
- ❌ Voices that are too niche or character-specific (unless needed)
- ❌ Low-quality or unclear voices
- ❌ Voices with heavy background noise
- ❌ Extremely unusual voices (unless specifically needed)

## Building Your Library Over Time

### Initial Setup (Week 1)
- Add 20-30 high-priority voices
- Focus on common combinations (American, British, various ages/genders)
- Test matching with real user descriptions

### Expansion (Week 2-4)
- Add 30-50 more voices based on:
  - User requests that couldn't be matched
  - Popular accent/gender/age combinations
  - Character types that are frequently requested

### Ongoing Maintenance
- Add voices as new ones become available in ElevenLabs library
- Replace low-quality voices with better alternatives
- Add voices for specific use cases as needed

## Testing Your Library

After adding voices, test the matching system with descriptions like:
- "65-year-old African male with deep raspy smoker's voice like a jazz musician"
- "Young female with British accent"
- "Middle-aged professional male voice"
- "Calm female narrator voice"

If a description doesn't match well, consider adding voices that would match it.

## Troubleshooting

### Voices Not Appearing in API
- **Check**: Are voices actually in "My Voices" in ElevenLabs UI?
- **Verify**: API key has access to your account
- **Wait**: Sometimes there's a brief delay (refresh after 1-2 minutes)

### Limited Voice Options
- **Solution**: Add more diverse voices to "My Voices"
- **Focus**: Add voices covering different accents, ages, genders, and characteristics

### Matching Not Working Well
- **Check**: Are voices properly tagged with characteristics?
- **Verify**: Voice descriptions include relevant keywords
- **Solution**: Add more voices that match common user requests

## Next Steps

1. Start with high-priority voices (20-30 voices)
2. Test the matching system
3. Expand based on gaps in coverage
4. Continue building library over time

Remember: The more diverse voices you add, the better the matching system will work!













