/**
 * Sprint 5.10 — HTML → plain-text fallback for sendEmail (#53).
 *
 * The text part is what inbox providers and screen readers see when
 * the HTML body fails to render. Pinning the conversion behavior so
 * a future templating change doesn't silently regress deliverability
 * by emitting blank or jumbled text.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { htmlToPlainText } from "../lib/email/html-to-text.ts";

test("drops <script> and <style> bodies entirely", () => {
  const html = `
    <p>Hello!</p>
    <script>alert('x')</script>
    <style>.a{color:red}</style>
    <p>Goodbye.</p>
  `;
  const text = htmlToPlainText(html);
  assert.ok(!text.includes("alert"));
  assert.ok(!text.includes("color:red"));
  assert.ok(text.includes("Hello!"));
  assert.ok(text.includes("Goodbye."));
});

test("preserves anchor URLs as label (href) pairs", () => {
  const html = `Click <a href="https://korent.app/track/abc">to track</a> your order.`;
  const text = htmlToPlainText(html);
  assert.ok(text.includes("to track (https://korent.app/track/abc)"));
});

test("collapses anchor label = href to a single URL", () => {
  const html = `<a href="https://korent.app">https://korent.app</a>`;
  const text = htmlToPlainText(html);
  assert.equal(text, "https://korent.app");
});

test("converts block-level tags to newlines", () => {
  const html = `<h1>Hi</h1><p>First.</p><p>Second.</p>`;
  const text = htmlToPlainText(html);
  // Should have blank lines between paragraphs but no triple-newlines.
  assert.ok(text.includes("Hi"));
  assert.ok(text.includes("First."));
  assert.ok(text.includes("Second."));
  assert.ok(!text.includes("\n\n\n"));
});

test("converts <br> to single newline", () => {
  const html = `Line one<br>Line two<br/>Line three`;
  const text = htmlToPlainText(html);
  assert.equal(text, "Line one\nLine two\nLine three");
});

test("decodes the entities we actually emit", () => {
  const html = `Tom &amp; Jerry &lt;3 said &quot;hi&quot; &#39;there&#39; &nbsp;you.`;
  const text = htmlToPlainText(html);
  assert.equal(text, `Tom & Jerry <3 said "hi" 'there' you.`);
});

test("strips unknown tags but keeps content", () => {
  const html = `<span style="color:red">Important: <strong>read me</strong></span>`;
  const text = htmlToPlainText(html);
  assert.equal(text, "Important: read me");
});

test("trims leading/trailing whitespace", () => {
  const html = `  \n  <p>Hello</p>  \n  `;
  const text = htmlToPlainText(html);
  assert.equal(text, "Hello");
});

test("real-ish order-confirmation snippet renders human-readable", () => {
  const html = `
    <html><body>
      <h1>Order confirmed</h1>
      <p>Hi Komlan, your booking <strong>#10042</strong> is confirmed.</p>
      <p>Track your delivery: <a href="https://korent.app/track/xyz">Open tracking</a></p>
    </body></html>
  `;
  const text = htmlToPlainText(html);
  assert.ok(text.startsWith("Order confirmed"));
  assert.ok(text.includes("#10042 is confirmed"));
  assert.ok(text.includes("Open tracking (https://korent.app/track/xyz)"));
});
