# Calories Counter

A personal calorie tracker for a small group of friends: each person keeps their own list of foods and records what they ate each day to see their calorie intake over time.

## Language

### People

**User**:
A person with an account. Every Food, Entry and Goal belongs to exactly one User and is never visible to another.
_Avoid_: member, customer, profile

**Allowed Email**:
A Google account email address permitted to become a User. Anyone else is refused at sign-in.
_Avoid_: invite, whitelist, approved user

**Owner**:
The one User who runs the app: they add Allowed Emails and may try any Toggle in Testing.
_Avoid_: admin, superuser

### Foods

**Food**:
Something a User eats, defined by a name, a Portion and the calories in one Portion.
_Avoid_: food item, product, ingredient, meal

**Portion**:
The fixed amount of a Food that its calories describe, written as the User would say it (e.g. "1 slice", "100 g", "1 bowl").
_Avoid_: serving, unit, serving size

**Food List**:
All of a User's Foods that are not Archived.
_Avoid_: library, pantry, catalog, database

**Archived**:
A Food that no longer appears in the Food List but is kept because past Entries refer to it.
_Avoid_: deleted, hidden, inactive

**Calories**:
Energy, always in kilocalories (kcal): eaten in a Food, or burned (Calories Burned). Values that arrive in kilojoules are converted on the way in.
_Avoid_: kJ, energy, cals

**Reference Food**:
A food from a shared, read-only Australian nutrition dataset, used only as a source of Suggestions; it is never logged directly.
_Avoid_: database food, generic food, AFCD item

**Suggestion**:
A candidate Food (name, Portion, Calories) produced by search, a best guess, an imported file or a photo of handwritten notes, which the User has not yet saved.
_Avoid_: draft, guess, result

**Import**:
A batch of Suggestions from one or more files or photos, which the User reviews, edits and then saves into their Food List in one go.
_Avoid_: upload, bulk add, batch

### Logging

**Entry**:
A record that a User ate, or plans to eat, some number of Portions of one Food on one Day.
_Avoid_: log item, meal, consumption, record

**Planned Entry**:
An Entry on a Day after today. It becomes an ordinary Entry when its Day arrives, with no confirming step, and until then no summary counts it.
_Avoid_: future log, meal plan, scheduled entry

**Quantity**:
The number of Portions in an Entry (e.g. 1.5).
_Avoid_: amount, servings, count

**Day**:
A calendar date as the User experiences it, with no time-of-day or time zone attached.
_Avoid_: date-time, timestamp

**Logged Day**:
A Day up to and including today with at least one Entry. Averages and Goal comparisons count Logged Days only, so a Day with no Entries is "not logged", never "zero".
_Avoid_: active day, tracked day

**Log**:
All of a User's Entries across every Day.
_Avoid_: diary, journal, history

**Reminder**:
A notification at a time of day the User chooses, sent only if today has no Entries yet (a Planned Entry for today counts), prompting them to log their food.
_Avoid_: alert, nudge, push

### Summaries

**Daily Total**:
The calories for one Day, always computed from each Entry's Quantity times its Food's current calories per Portion.
_Avoid_: daily calories, intake

**Goal**:
An optional number of calories a User aims to eat per Day.
_Avoid_: target, budget, limit

**Calories Burned**:
The total Calories a User's body used on one Day, resting plus activity, as their watch reports it. Optional: a User who doesn't track it never sees it.
_Avoid_: exercise calories, active calories, TDEE, burn

**Deficit**:
Calories Burned minus the Daily Total, for a Day that has both. A negative Deficit is shown as a **Surplus**.
_Avoid_: net calories, balance, remaining

**Period**:
A named range of Days that a summary covers, such as week to date, month to date, last week, or last month.
_Avoid_: range, window, timeframe

### Toggles

**Toggle**:
The control a new feature ships behind, so it can reach production before everyone sees it. Each Toggle is in exactly one state: Testing, Live or Removed.
_Avoid_: flag, feature flag, switch, experiment

**Testing**:
A Toggle that is off for everyone except the Users allowed to try it, who each turn it on or off for themselves.
_Avoid_: beta, preview, draft

**Live**:
A Toggle that is on for every User. A Live Toggle never goes back to Testing.
_Avoid_: released, shipped, enabled

**Removed**:
A Toggle that is off for every User, whose feature is being deleted. A Removed Toggle never comes back.
_Avoid_: disabled, killed, archived
