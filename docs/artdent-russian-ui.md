# Russian-only ArtDent demo

The demo renders Russian copy on the server and in React components. It does
not translate a page after it loads, mutate React's DOM, wait for hydration,
hide English content behind a timer, or offer an English-language switch.
The document language is `ru`; old `harly_lang` cookies have no effect.

Static copy lives in the source components. `lib/localize-system-text.ts` is a
pure render-time adapter for system error messages and default stage names
that come from the existing backend or stored data. It uses the smaller
`locales/system-ru.json` catalogue, including validated numbered placeholders.
Do not apply this adapter to candidate text, notes, vacancy descriptions or
user-defined titles. Internal enum values, form values and API contracts remain
in their original format. `lib/toast.ts` applies this adapter before rendering
API error notifications. Dates use `ru-RU` / date-fns' Russian locale.

The scripts under `tooling/harly/` prepare reviewable source translations;
they are not part of the build or runtime. If adding system copy to the backend,
add its translation to `ru-overrides.json` and regenerate the compact catalogue:

```sh
node tooling/harly/build-system-catalogue.mjs
```

Verify initial server HTML and dynamic messages with
`apps/web/src/lib/russian-rendering.test.tsx`, then test navigation, loading,
empty states, errors, filter values and default stage labels in the browser.
External service names, technical identifiers, addresses and user content
retain their original spelling.
