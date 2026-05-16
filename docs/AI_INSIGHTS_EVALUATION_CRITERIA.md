# AI Insights Evaluation Criteria

This guide defines how the TV and Movie Taste Profile features should behave across common data-quality scenarios. It applies to both `/ai-insights` and `/movies/ai-insights` and uses the current profile shape:

- `tasteSummary`
- `topGenres`
- `favoritePatterns`
- `recentTrends`
- `discoveryLanes`
- `tasteArchetype`

The goal is to keep AI-generated taste profiles useful without overstating what the user's history can support.

## Confidence Tiers

Use these tiers as evaluation guidance for judging whether the output is appropriately confident.

| Tier | Source data | Expected handling |
| --- | --- | --- |
| No signal | No TV watchlist items or no movie list items | Do not present a confident taste profile. Prompt the user to add watched or rated items first. |
| Very limited signal | 1-3 usable watched or rated items | Generation can be allowed, but the output must clearly frame itself as early, limited, or provisional. |
| Limited signal | 4-7 usable watched or rated items | Output can describe visible patterns, but should avoid sweeping claims and call out thin areas when relevant. |
| Healthy signal | 8+ usable watched or rated items with some genre, rating, or date variety | Output can make firmer taste claims while still staying grounded in the supplied data, including an optional taste archetype. |

Usable items are watched, rated, or otherwise activity-backed entries. Items that are only added to a list can inform the profile lightly, but should not carry the same weight as watched or rated history.

## Scenario Criteria

| Scenario | Output behavior |
| --- | --- |
| Empty list | Show an empty or onboarding state instead of a confident profile. Encourage adding watched or rated TV seasons or movies. |
| Very few watched or rated items | Allow a profile only with visible limited-confidence wording. Avoid definitive claims like "you always prefer" or "your taste is clearly." |
| Items added but not watched or rated | Treat these as weak preference signals. Mention possible interests only cautiously and do not infer strong taste patterns from list membership alone. |
| Less than healthy signal | Return `tasteArchetype` as `null`. The UI should hide the full archetype section instead of showing provisional archetype labels. |
| Missing watched dates | Omit `recentTrends` or return it empty. The UI should explain that there is not enough dated activity to call a clear trend. |
| Only recent dated items | Summarize current taste, but avoid trend language because there is no older baseline for comparison. |
| Only old dated items | Frame the result as based on historical activity. Avoid implying that the profile fully reflects current taste. |
| Narrow genre history | Acknowledge the focused pattern instead of pretending breadth. Discovery lanes may suggest adjacent directions without inventing wider history. |
| Conflicting ratings or obvious outliers | Avoid overfitting to one item. Favor patterns supported by multiple entries or describe the contrast directly. |
| Missing genre or metadata | Use available titles, descriptions, ratings, dates, and activity. Keep claims conservative when metadata is sparse. |
| Mixed TV and movie expectations | Keep TV and movie behavior parallel, but respect media-specific signals: TV seasons and season ratings for TV, watched dates and movie ratings for movies. |
| Provider or generation failure | Do not overwrite a previous saved insight. Show friendly retry copy and preserve detailed diagnostics in backend logs. |
| Outdated or invalid saved profile | Prompt regeneration rather than displaying broken or schema-incompatible content. |

## Output Rules

- Use only supplied data. Do not invent watched titles, ratings, dates, genres, platforms, or activity.
- Write directly to the user in second person using "you" and "your."
- Keep the tone warm, compact, specific, and recommendation-ready.
- Avoid generic analytics language and obvious dashboard stats unless they are necessary for a caveat.
- Generated profile output must be valid JSON, with every array item written as a quoted JSON string.
- `tasteSummary` should explain likely taste across genre, tone, pacing, themes, character/plot balance, and style without naming specific watched shows or movies.
- `tasteSummary` should use supplied titles only as private evidence and generalize them into traits instead of listing examples.
- `topGenres` should contain only actual saved source genres from watched or rated TV/movie metadata. Tone, format, pacing, theme, trope, archetype, and storytelling-style labels belong in `favoritePatterns`, `discoveryLanes`, or `tasteArchetype`, not Top Genres.
- `favoritePatterns` should describe traits already visible in watched or rated history.
- `discoveryLanes` should suggest broad directions to explore next, not specific title recommendations.
- `recentTrends` should appear only when dated activity supports a meaningful shift in genre, tone, pacing, format, era, style, or viewing habits.
- `tasteArchetype` should appear only for `healthy_signal` profiles and should include a primary archetype, 2-4 secondary archetypes, an avoidance pattern, and a recommendation north star.
- `tasteArchetype` labels should be vivid, compact, recommendation-useful, and grounded in supported watched or rated history.
- `tasteArchetype.avoidancePattern` should rely on low ratings, dropped/unfinished activity, or clear contrast with liked history; if the evidence is indirect, phrase it cautiously.
- Empty arrays are acceptable when the data does not support a section.

## Acceptance Checks

- Empty and low-signal states are not overconfident.
- Very limited profiles include a visible caveat or limited-confidence framing.
- `tasteArchetype` is `null` and hidden for very limited and limited profiles.
- Healthy profiles may render the archetype section only when all four archetype sub-areas are present and valid.
- `recentTrends` is absent or empty when dates are missing, too sparse, or too recent-only to support a trend.
- `tasteSummary` does not include exact supplied TV show or movie titles.
- `topGenres` does not include labels outside the saved watched/rated source genres.
- Profile parsing can repair a bare string inside known string-array fields, but arbitrary malformed JSON still fails.
- Generated output respects schema limits and does not require client-side repair to render safely.
- Failure states do not overwrite existing saved profiles.
- Outdated or invalid saved profiles route the user toward regeneration.
- TV and movie behavior stays parallel unless media-specific data requires different handling.
- The profile remains useful to someone recommending shows or movies without needing to see the underlying list.
