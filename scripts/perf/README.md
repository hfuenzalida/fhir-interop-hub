# Performance / soak scripts (optional)

Heavier benchmarks than **unit** or **integration** tests belong here or under **`scripts/load/`** (k6).

| Location | Use |
|----------|-----|
| **`scripts/load/`** | k6 smoke — **`README.md`** in that folder |
| **`scripts/perf/`** | Longer soak, custom Node scripts, Locust — add as needed |

**CI:** Keep **PR** pipeline fast; run soak tests **nightly** or **`workflow_dispatch`** only (**`docs/GAP9_TESTING.md`**).

**Phase VII:** Define budgets in **`docs/templates/PERFORMANCE_BUDGETS.md`**.
