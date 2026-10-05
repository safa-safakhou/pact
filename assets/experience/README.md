# Generated experience assets

This is the bounded PACT-114-119/122/123 pack: 58 logical inventory entries, 47 physical media files, sixteen character lines and seven factual templates. The inventory in ../../docs/implementation/experience-inventory.json records source/export hashes, dimensions or durations, placement/event, privacy and native fallback. Four motion entries share one CSS file; templates and character lines share copy.json.

The approved PNG originals and exact built-in imagegen prompts are preserved here. Re-running a saved prompt is a new generation, not a byte-identical recreation. Original imagegen use: two proof images plus eleven additional character poses, thirteen calls in total. Tool billing was not returned and is unknown. No third-party stock or external production account was used. Audio/vector/copy synthesis and mechanical exports run locally without an external generation charge; local compute cost is not measured.

## Regeneration

Use Python 3 with Pillow 12.3.0 for the two mechanical raster exports. This session used the bundled Windows Python through the WSL repository path; the other scripts use Python stdlib and run directly in WSL. Run from the repository root, in this order:

```sh
python3 assets/experience/export_characters.py
python3 assets/experience/export_texture.py
python3 assets/experience/generate_scene.py
python3 assets/experience/export_motion.py
python3 assets/experience/generate_music.py
python3 assets/experience/generate_effects.py
python3 assets/experience/generate_cards.py
python3 assets/experience/generate_keepsakes.py
python3 assets/experience/generate_harvest.py
python3 assets/experience/verify_inventory.py
```

The character exporter recreates character copy; the later card generator restores the seven templates. Source originals are never replaced. Procedural scripts save their seeds/scores, gain, source metadata and manifests. Audio is finite mono PCM at 22050 Hz. SVG, CSS, WAV and mechanical PNG exports were regenerated in this session: all 47 media hashes were identical. JSON logical fragments use canonical hashes rather than whitespace formatting.

After an intentional source change, inspect/audition the output, then refresh measured metadata explicitly with `python3 assets/experience/verify_inventory.py --write`. Routine verification uses no flag and fails on drift. To restore repository JSON formatting, run the pinned Biome formatter over changed manifests and copy.json, then run the verifier again.

## Packaging and review

The existing `npm run build` copies apps/web/public/experience into the web build; no additional publishing route or server is required. Only this public export folder ships. Source originals/prompts/scripts stay outside the public directory. All public files, including captions and asset previews, total 3,265,067 bytes; the main application's measured maximum initial media transfer was 328,465 bytes in the PACT-124 fixtures. Limits are 8 MiB total and 3 MiB initial.

The developmental /experience-context.html uses actual game components with labelled synthetic records. It is not a production Vite entry. Isolated audio/portrait preview pages are manual, silent on load, and do not mutate the game. The production entry is the ordinary GameApp.

Factual event keys and owner authorization own presentation. Characters never become accounts, counterparties or agents. Waiting stays silent. Refreshes, reconnects and routine installments cannot replay celebrations. Audio requires a human gesture; controls include mute, separate volumes, humour and motion. Native text/source IDs remain available if all media fails.

Founder proof listening: "Sounds clean." Seven-cue listening: "Seems like clean, but I have to be able to listen to them in its place in the game to understand exactly what it does mean." Contextual music/ambience/flourish reply: "I think it should be okay." These are actual, limited observations, not a guarantee of enjoyment. Reports and browser/SQL evidence are in ../../docs/implementation/reports/game-experience-implementation.md.
