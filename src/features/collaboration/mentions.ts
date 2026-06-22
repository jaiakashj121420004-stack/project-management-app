/**
 * @mention helpers. The composer writes mentions as plain, human-readable
 * `@Display Name` text (nice to type and to read), and we resolve them against
 * the project roster — so there are no opaque tokens in a comment body. The
 * resolved user ids are stored in `comment_mentions`, which the DB trigger turns
 * into notifications; the renderer (MentionText) re-highlights the same names.
 */

export interface Mentionable {
  userId: string;
  displayName: string | null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Members with a usable name, longest-first so "@Anna" wins over "@Ann". */
function namedMembers(members: Mentionable[]): { userId: string; name: string }[] {
  return members
    .flatMap((member) => {
      const name = member.displayName?.trim();
      return name ? [{ userId: member.userId, name }] : [];
    })
    .sort((a, b) => b.name.length - a.name.length);
}

/** A single alternation matching `@<any member name>`, or null if no names. */
export function mentionRegex(members: Mentionable[]): RegExp | null {
  const names = namedMembers(members).map((member) => escapeRegExp(member.name));
  if (names.length === 0) return null;
  // Not followed by a word char so "@Ann" doesn't match inside "@Anna".
  return new RegExp(`@(${names.join('|')})(?![\\w])`, 'gi');
}

/** The user ids of members actually @mentioned in `body` (for comment_mentions). */
export function resolveMentionedUserIds(body: string, members: Mentionable[]): string[] {
  const ids = new Set<string>();
  for (const member of namedMembers(members)) {
    const pattern = new RegExp(`@${escapeRegExp(member.name)}(?![\\w])`, 'i');
    if (pattern.test(body)) ids.add(member.userId);
  }
  return [...ids];
}
