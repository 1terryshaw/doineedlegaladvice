import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import PracticeSearchNotice from "../components/PracticeSearchNotice";
import { detectPracticeTerm } from "../lib/practice-search";

test("detects whole practice terms without matching substrings", () => {
  for (const query of ["family", "Family Law", "DIVORCE", "custody", "immigration", "visa", "criminal", "DUI/DWI", "DUI", "DWI", "personal injury", "bankruptcy", "employment", "estate", "wills", "real estate", "tax", "business", "IP", "patent", "trademark"]) {
    assert.ok(detectPracticeTerm(query), `${query} should be detected`);
  }
  assert.equal(detectPracticeTerm("familylaw"), null);
  assert.equal(detectPracticeTerm("Family Law in New York"), null);
  assert.equal(detectPracticeTerm("businesses"), null);
  assert.equal(detectPracticeTerm("  "), null);
});

test("renders an honest practice search note and keeps matching business-name results", () => {
  const term = detectPracticeTerm("Family Law");
  assert.ok(term);
  const markup = renderToStaticMarkup(
    <>
      <PracticeSearchNotice term={term} />
      <ul>{["Family Law Group", "Family Law Offices", "New York Family Law", "Family Law Attorneys"].map((name) => <li key={name}>{name}</li>)}</ul>
    </>
  );
  assert.match(markup, /We don&#x27;t have practice-area data for lawyers yet/);
  assert.match(markup, /can&#x27;t filter by &quot;Family Law&quot;/);
  assert.match(markup, /Results below only match business names/);
  assert.match(markup, /href="\/\#triage"/);
  assert.equal((markup.match(/<li>/g) ?? []).length, 4);
});
