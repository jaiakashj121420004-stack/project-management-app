/**
 * A file that fundamentally isn't a recognisable Trello export or CSV import
 * — thrown with a specific, human-readable explanation of the format problem
 * (unlike most Aurora input errors, which show a generic "try again"), so
 * `ImportModal` can surface `error.message` verbatim.
 */
export class ImportParseError extends Error {}
