# Valibot Named Pipe Convention

Reference for `packages/shared/src/validations`. Apply these rules to stay consistent with existing schemas.

## What Is a Named Pipe?

A **named pipe** is a `v.pipe(...)` expression assigned to a `const` at module scope (or returned from a function) instead of being written inline inside a schema field. It gives a reusable validator a name.

```ts
// named pipe — extracted to a const
const optionalUuid = v.optional(v.pipe(v.string(), v.uuid("Invalid ID")));

// inline pipe — lives directly in the schema field
homeTeamId: v.pipe(v.string(), v.uuid("Invalid home team ID"))
```

---

## Decision Rules

| Situation | What to do |
|---|---|
| Same pipe appears in 2+ fields in the file | Extract to a named `const` |
| Pipe has 3+ validators and obscures schema readability | Extract to a named `const` |
| Pipe constraint varies per call site (e.g., different `maxLength`) | Extract to a **parametric function** returning the pipe |
| Cross-field validation on an object schema | Wrap the whole schema: `v.pipe(v.object(…), v.forward(…))` |
| Single-use pipe with 1–2 validators | Keep inline — a name adds no value here |

---

## Pattern Reference

### Pattern 1 — Simple reusable field helper (`scrim.ts`)

Same shape appears in multiple fields; extracted to a named const.

```ts
const optionalUuid = v.optional(v.pipe(v.string(), v.uuid("Invalid ID")));
const optionalIsoDate = v.optional(v.pipe(v.string(), v.isoTimestamp("Invalid timestamp")));
const nullableShortString = v.nullable(v.pipe(v.string(), v.trim(), v.maxLength(120)));
```

### Pattern 2 — Parametric helper (`scrim.ts`)

Shape is reused but constraints vary per call site; extracted to a function.

```ts
const optionalTrimmedString = (maxLength: number, message: string) =>
    v.optional(v.pipe(v.string(), v.trim(), v.maxLength(maxLength, message)));
```

### Pattern 3 — Complex reusable validator (`auth.ts`, `org.ts`)

Multi-rule logic that would obscure the schema if inlined, or is reused across multiple schemas.

```ts
const passwordComplexityPipe = v.pipe(
    v.string(),
    v.nonEmpty("Password is required"),
    v.minLength(8, "Password must be at least 8 characters"),
    v.maxLength(128, "Password must be at most 128 characters"),
    v.regex(RE_LOWERCASE, "Password must contain at least one lowercase letter"),
    v.regex(RE_UPPERCASE, "Password must contain at least one uppercase letter"),
    v.regex(RE_NUMBER, "Password must contain at least one number"),
    v.regex(RE_SPECIAL, "Password must contain at least one special character")
);
```

### Pattern 4 — Cross-field object pipe (`onboarding.ts`, `auth.ts`)

Cross-field checks are added by wrapping the whole object schema in `v.pipe`. This is a schema-level pattern, not a field-level helper.

```ts
export const RolesAndRankSchema = v.pipe(
    v.object({ … }),
    v.forward(v.check((input) => …, "Secondary role cannot match primary"), ["secondaryRole"]),
    v.forward(v.check((input) => …, "Please select a division"), ["rankDivision"]),
);
```

---

## Canonical Before / After (`auth.ts`)

This is the clearest example of when to name a pipe: complex rules that would be duplicated across multiple fields.

**Before — inline, duplicated:**

```ts
export const RegisterSchema = v.object({
    password: v.pipe(
        v.string(),
        v.nonEmpty("Password is required"),
        v.minLength(8, "Password must be at least 8 characters"),
        v.maxLength(128, "Password must be at most 128 characters"),
        v.regex(RE_LOWERCASE, "Password must contain at least one lowercase letter"),
        v.regex(RE_UPPERCASE, "Password must contain at least one uppercase letter"),
        v.regex(RE_NUMBER, "Password must contain at least one number"),
        v.regex(RE_SPECIAL, "Password must contain at least one special character")
    ),
    confirmPassword: v.pipe(
        v.string(),
        v.nonEmpty("Password is required"),
        // … same 8 rules repeated …
    ),
});
```

**After — named, reused:**

```ts
const passwordComplexityPipe = v.pipe(
    v.string(),
    v.nonEmpty("Password is required"),
    v.minLength(8, "Password must be at least 8 characters"),
    v.maxLength(128, "Password must be at most 128 characters"),
    v.regex(RE_LOWERCASE, "Password must contain at least one lowercase letter"),
    v.regex(RE_UPPERCASE, "Password must contain at least one uppercase letter"),
    v.regex(RE_NUMBER, "Password must contain at least one number"),
    v.regex(RE_SPECIAL, "Password must contain at least one special character")
);

export const RegisterSchema = v.object({
    password: passwordComplexityPipe,
    confirmPassword: passwordComplexityPipe,
});
```

---

## Naming Convention

- Use camelCase.
- Name reflects shape and intent: `optionalUuid`, `nullableShortString`, `passwordComplexityPipe`.
- Avoid generic names like `pipe1` or `stringPipe`.
- Prefer `optional*` / `nullable*` prefixes when the outer wrapper is `v.optional` / `v.nullable`.
- Suffix `*Pipe` when the const is a bare `v.pipe(...)` without an outer wrapper (e.g., `passwordComplexityPipe`).
