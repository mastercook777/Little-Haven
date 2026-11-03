# Little Haven — Development Roadmap

## v0.1: Living Valley (baseline)
- [x] Pastel procedural Three.js diorama, orbit/zoom and camera reset
- [x] Resident schedules and simple activity animation
- [x] Day/night cycle, adjustable time speed, pause and local save
- [x] One mutually exclusive guardian decision: bridge vs. garden
- [x] Visible construction progress and valley chronicle
- [x] Pure simulation regression tests
- [ ] Verify installed production build in CI and actual WebGL/mobile browser QA

## v0.2: The Valley Grows (P0)
1. **Autonomous development loop.** Resource/need -> villager proposal -> support/decline -> construction -> new activity -> next proposal; repeatable without resetting the game.
2. **Resident navigation.** Use simple walkable graph/navmesh with obstacle and shoreline avoidance. Movement should follow consistent paths instead of passing through houses.
3. **Lived-in interactions.** Two or more residents can meet, chat and then resume independent routines. Player can zoom in to discover their work and short-term goals.
4. **Consequences.** Guardian decisions should meaningfully affect visible construction, NPC destinations and journal, with at least two distinct branch outcomes.
5. **Testing.** Add determinism, persistence, offline-resume and automated browser smoke checks (desktop first, mobile if available).

## Later possibilities (not v0.2 commitments)
- Natural footpath growth based on traffic; evolving market spaces
- Resident relationships, memory, multi-generational history
- Multiple village characters (merchant outpost, farming hamlet, fortress)
- Seasonal rituals and richer miniature storytelling

## Design guardrail
Do not chase more buildings, larger maps, elaborate economy or AAA assets before the first repeatable self-growth loop is fun to watch.
