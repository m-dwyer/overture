# Overture Context

Overture is a groovebox for Ableton Move built as a Schwung tool module. This context names the musical objects Overture owns and distinguishes them from native Move concepts that exist outside Overture's control.

## Language

**Move Clip**:
A native Ableton Move clip that exists in a Set outside Overture's ownership.
_Avoid_: Scene, Overture Scene

**Move Scene**:
A native Ableton Move column that groups up to four Move Clips for launch.
_Avoid_: Overture Scene, Clip

**Move Set**:
A native Ableton Move container that exists outside Overture's ownership.
_Avoid_: Overture Project, Set when the distinction matters

**Overture Project**:
The top-level Overture-owned musical state within a Move Set context.
_Avoid_: Set, Song

**Move Note Mode**:
The native Ableton Move mode for playing, sequencing, recording, capturing, and editing Move Clips.
_Avoid_: Overture Track View

**Track View**:
The Overture view for playing, sequencing, and editing the selected Track and Selected Clip Cell.
_Avoid_: Note View, Move Note Mode

**Overture Session View**:
The Overture view where visible Track rows and Scene columns form Clip Cells for selection and launch.
_Avoid_: Move Session Mode

**Control State**:
Transient Overture control-surface context such as the current control mode, Track Selection, Selected Clip Cell, selected Step, visible Track Bank, and held modifiers.
_Avoid_: Project state, Sequence data, render state

**Hardware Input**:
A Move control event after raw MIDI parsing but before Overture context interpretation.
_Avoid_: Domain Intent, raw MIDI

**Domain Intent**:
An Overture intent interpreted from Hardware Input in the current Overture context.
_Avoid_: Hardware Input, Host Command, raw MIDI

**Surface Hint**:
A visual preview on the control surface that shows possible Domain Intents for
the current view, selection, and held modifiers before the complete Hardware
Input combination is made.
_Avoid_: Render state, Host Command

**Host Command**:
An outbound instruction from Overture core for the host adapter to execute.
_Avoid_: Domain Intent, Hardware Input

**Overture Scene**:
An Overture-owned column that groups Overture Clips across Tracks for launch.
_Avoid_: Move Scene, Clip, Pattern

**Scene Page**:
A future group of Overture Scenes used if a Project grows beyond the initial visible scene columns.
_Avoid_: Page when referring to Track View editing pages

**Overture Clip**:
An Overture-owned musical container for one Track at one Overture Scene position.
_Avoid_: Move Clip, Scene, Pattern

**Clip ID**:
The immutable identity of an Overture Clip for that clip object's lifetime.
_Avoid_: Clip Cell coordinate

**Track**:
One of up to eight routed musical parts in an Overture project.
_Avoid_: Lane, Move Track when referring to Overture-owned tracks

**Track Index**:
The zero-based internal identity of a Track.
_Avoid_: Track Number, Track ID

**Track Number**:
The one-based user-facing label for a Track.
_Avoid_: Track Index

**Scene Index**:
The zero-based internal identity of an Overture Scene.
_Avoid_: Scene Number, Scene ID

**Scene Number**:
The one-based user-facing label for an Overture Scene.
_Avoid_: Scene Index

**Lane**:
A sub-track musical row used for finer-grained sequencing inside a Track, such as drum-pad sequencing.
_Avoid_: Track

**Track Route**:
The user-changeable destination class for a Track across all of that Track's Overture Clips.
_Avoid_: Slot, Component

**Move Route**:
A Track Route that sends Track playback to native Move.
_Avoid_: MIDI Route, Native Route

**Move Track Target**:
The native Move Track addressed by a Move-routed Overture Track.
_Avoid_: Overture Track

**Route Conflict**:
A warning state where multiple Tracks share a destination that may produce surprising playback.
_Avoid_: Invalid route

**Schwung Route**:
A Track Route that sends Track playback to Schwung.
_Avoid_: Internal Route

**Schwung Chain**:
The route-specific sound destination for a Schwung-routed Track.
_Avoid_: Voice, generic Sound Chain unless provider-neutral chains exist

**Component**:
A sound-chain role such as MIDI FX, Synth, FX 1, or FX 2.
_Avoid_: Slot

**Slot**:
A Schwung runtime slot or channel assignment backing a Component.
_Avoid_: Component, Clip Cell

**Default Route Template**:
The initial Track Route assignment for a new Overture project.
_Avoid_: Fixed routing

**Track Bank**:
A visible group of four Overture Tracks used to address the eight-track project on Move's four-row hardware surface.
_Avoid_: Page, Scene

**Track Bank 1**:
The Track Bank containing Overture Tracks 1-4.
_Avoid_: Move Bank, Lower Bank

**Track Bank 2**:
The Track Bank containing Overture Tracks 5-8.
_Avoid_: Schwung Bank, Upper Bank

**Track Selection**:
The selected Track addressed by track buttons and Track View.
_Avoid_: Clip selection

**Route-Neutral Track Data**:
The musical data that remains part of a Track when its Track Route changes.
_Avoid_: Sound settings, route settings

**Route-Specific Track Data**:
The destination-specific data that may become inactive or invalid when a Track Route changes.
_Avoid_: Pattern data, composition data

**Inactive Route Data**:
Route-Specific Track Data retained for a Track while another Track Route is active.
_Avoid_: Deleted route data

**Sequence**:
The route-neutral musical content of an Overture Clip.
_Avoid_: Pattern in domain language

**Step**:
One editable time position in a step-based Sequence.
_Avoid_: Pad, event

**Step Index**:
The zero-based internal identity of a Step.
_Avoid_: Step Number

**Step Number**:
The one-based user-facing label for a Step.
_Avoid_: Step Index

**Motion**:
Overture's automation layer.
_Avoid_: Automation except when explaining the concept

**Sequence Motion**:
Route-neutral Motion stored in an Overture Clip's Sequence.
_Avoid_: Route Motion

**Route Motion**:
Motion targeting route-specific destination parameters.
_Avoid_: Sequence Motion

**Unmapped Motion**:
Motion retained after its target parameter is unavailable.
_Avoid_: Deleted Motion

**Tick**:
An internal timing subdivision used inside and between Steps.
_Avoid_: Step, MIDI clock pulse

**Bar**:
A musical span of 16 Steps in a step-based Sequence.
_Avoid_: Page, Scene

**New Overture Scene**:
An empty or default Overture Scene created without copying the currently selected Overture Scene.
_Avoid_: Duplicate

**Duplicate Overture Scene**:
A new Overture Scene created by copying an existing Overture Scene.
_Avoid_: New scene

**New Overture Clip**:
An empty or default Overture Clip created without copying the currently selected Overture Clip.
_Avoid_: Duplicate

**Duplicate Overture Clip**:
A new Overture Clip created by copying an existing Overture Clip.
_Avoid_: New clip

**Overwrite Clip**:
Replacing an occupied Clip Cell with another Overture Clip.
_Avoid_: Merge, overdub

**Clip Cell**:
An addressable position in Overture Session View at one Track and one Overture Scene position that may be empty or contain one Overture Clip.
_Avoid_: Slot

**Clip Cell Coordinate**:
The Track Index and Scene Index pair that identifies a Clip Cell.
_Avoid_: Clip ID

**Selected Clip**:
The Overture Clip currently focused for editing.
_Avoid_: Active Clip

**Selected Clip Cell**:
The Clip Cell currently focused for editing or clip creation.
_Avoid_: Focused Clip Cell, Created clip

**Playing Clip**:
An Overture Clip currently producing playback.
_Avoid_: Active Clip

**Queued Clip**:
An Overture Clip scheduled to start at the next launch boundary.
_Avoid_: Active Clip

**Empty Clip Cell**:
A Clip Cell without an Overture Clip.
_Avoid_: Missing clip

**Empty Overture Clip**:
An Overture Clip whose Sequence contains no events.
_Avoid_: Empty Clip Cell

**Clip Launch**:
Starting one Overture Clip on its Track without changing other Tracks.
_Avoid_: Scene Launch

**Scene Launch**:
Starting an Overture Scene across all Tracks, launching occupied Clip Cells and stopping Tracks with Empty Clip Cells.
_Avoid_: Clip Launch

**Launch Boundary**:
The musical time boundary where queued clip or scene launches take effect.
_Avoid_: Immediate launch when transport is running

## Relationships

- An **Overture Project** contains **Tracks**, **Overture Scenes**, and **Overture Clips**.
- One **Overture Project** exists within one **Move Set** context.
- An **Overture Project** has up to eight **Tracks**, addressed as **Track Bank 1** and **Track Bank 2**.
- An **Overture Project** initially has eight **Overture Scenes**.
- An initial **Overture Project** has 64 **Clip Cells** across eight **Tracks** and eight **Overture Scenes**.
- Internal identities use **Track Index**, **Scene Index**, and **Step Index**; user-facing labels use **Track Number**, **Scene Number**, and **Step Number**.
- **Track Index** is the structural identity of a **Track** in the initial architecture.
- **Scene Index** is the structural identity of an **Overture Scene** in the initial architecture.
- **Overture Session View** shows the current **Track Bank** as rows, **Overture Scenes** as columns, and **Clip Cells** as pad positions.
- **Track Bank** changes which **Tracks** are visible as rows; **Overture Scene** columns remain stable.
- **Hardware Input** is interpreted into **Domain Intent** using the current Overture context.
- Held modifiers and view-local context may produce **Surface Hints** before a
  complete **Hardware Input** combination becomes a **Domain Intent**.
- Track buttons perform **Track Selection** within the current **Track Bank**.
- Pads perform **Clip Cell** selection in **Overture Session View**.
- Selecting a **Clip Cell** also updates **Track Selection** to that cell's **Track**.
- The visible **Track Bank** follows **Track Selection** by default.
- **Track View** edits the selected **Track** and **Selected Clip Cell**.
- An **Overture Scene** groups up to one **Overture Clip** per **Track** across all eight **Tracks**.
- An **Overture Clip** belongs to exactly one **Track** and one **Overture Scene**.
- A **Track** stays global across **Overture Scenes**.
- A **Track** has exactly one current **Track Route** shared by all of its **Overture Clips**.
- A **Track Route** is either a **Move Route** or a **Schwung Route**.
- A **Move Route** has exactly one **Move Track Target**.
- Overture does not own native Move sound state behind a **Move Track Target**.
- Multiple **Tracks** may share a **Move Track Target**, producing a **Route Conflict** warning rather than an invalid project.
- A **Schwung Route** has exactly one **Schwung Chain**.
- A **Schwung Chain** has Components backed by Schwung **Slots**.
- The **Default Route Template** gives Overture Tracks 1-4 a **Move Route** and Overture Tracks 5-8 a **Schwung Route**.
- The **Default Route Template** does not prevent rerouting a **Track**.
- **Route-Neutral Track Data** stays with a **Track** when its **Track Route** changes.
- **Route-Specific Track Data** belongs to the current **Track Route**.
- **Inactive Route Data** is retained in the **Overture Project** so a previous **Track Route** can be restored.
- An **Overture Clip** has exactly one route-neutral **Sequence**.
- **Sequence Motion** belongs to an **Overture Clip** through its **Sequence**.
- **Route Motion** belongs to an **Overture Clip** and targets **Route-Specific Track Data**.
- **Route Motion** becomes inactive when its target **Track Route** is inactive.
- Inactive **Route Motion** is retained with its **Overture Clip**.
- **Unmapped Motion** is retained until it is remapped or explicitly deleted.
- A **Lane** may exist inside a **Sequence** when the Track needs sub-track sequencing.
- A step-based **Sequence** contains one or more **Steps**.
- A **Step** can be subdivided into one or more **Ticks**.
- A **Bar** spans 16 **Steps**.
- A **Track** may contain one or more **Lanes** when the Track needs sub-track sequencing.
- A **Move Clip** is distinct from an **Overture Clip**.
- A **Move Scene** is distinct from an **Overture Scene**.
- A **New Overture Scene** does not copy the currently selected **Overture Scene**.
- A **Duplicate Overture Scene** copies an existing **Overture Scene**.
- A **New Overture Clip** does not copy the currently selected **Overture Clip**.
- A **Duplicate Overture Clip** copies an existing **Overture Clip**.
- **Overwrite Clip** replaces the existing **Overture Clip** in a **Clip Cell** with another **Overture Clip**.
- A **Clip Cell** contains zero or one **Overture Clip**.
- A **Clip Cell** is identified by its **Clip Cell Coordinate**.
- An **Overture Clip** is identified by its **Clip ID**.
- Moving or editing an **Overture Clip** preserves its **Clip ID**.
- Copying, duplicating, or overwriting creates a new **Clip ID** for the new **Overture Clip**.
- Overture runtime/control context has one **Selected Clip Cell**.
- The **Selected Clip Cell** is a **Clip Cell Coordinate** into the **Overture Project**.
- An **Empty Overture Clip** still exists in a **Clip Cell**.
- An **Empty Clip Cell** has no **Overture Clip**.
- Selecting an **Empty Clip Cell** does not create an **Overture Clip**.
- A **Selected Clip Cell** can be empty or contain a **Selected Clip**.
- A **Selected Clip** exists only when the **Selected Clip Cell** contains an **Overture Clip**.
- A launched **Empty Overture Clip** becomes the **Playing Clip** for its **Track** and plays silence.
- An **Empty Clip Cell** stops its **Track** when its **Overture Scene** is launched.
- A **Clip Launch** affects one **Track**.
- A **Scene Launch** affects all eight **Tracks**.
- When transport is running, **Clip Launch** and **Scene Launch** initially take effect at the next bar **Launch Boundary** by default.
- Each **Track** has zero or one **Playing Clip**.
- Each **Track** has zero or one **Queued Clip**.
- **Playing Clip** and **Queued Clip** state reference **Clip ID**.
- Moving a **Playing Clip** to another **Clip Cell** does not stop playback.
- A copied or duplicated **Overture Clip** does not inherit **Playing Clip** state.
- Deleting a **Playing Clip** stops its **Track** immediately.
- Deleting a **Queued Clip** clears that **Track**'s queued launch.
- Overwriting a **Playing Clip** stops its **Track** immediately.
- Overwriting a **Queued Clip** clears that **Track**'s queued launch.
- A **Selected Clip**, **Playing Clip**, and **Queued Clip** can be different **Overture Clips**.

## Example Dialogue

> **Dev:** "When we create a clip in Overture Session View, are we creating a native Move Clip?"
> **Domain expert:** "No. That is an **Overture Clip** for one **Track** at one **Overture Scene** position."

> **Dev:** "Should Overture call its top-level state a Set?"
> **Domain expert:** "No. A **Move Set** is native Move's container. Overture's top-level owned state is an **Overture Project**."

> **Dev:** "Should Overture call its editing view Note View?"
> **Domain expert:** "No. **Move Note Mode** is native Move language. Overture uses **Track View** for the selected Track and Clip Cell workflow."

> **Dev:** "Should Overture Session View flip Move's grid orientation?"
> **Domain expert:** "No. Mirror Move: visible **Track** rows, **Overture Scene** columns, and **Clip Cells** at row-column intersections."

> **Dev:** "Does a pad press always mean the same thing?"
> **Domain expert:** "No. A pad press is **Hardware Input**. Overture interprets it into **Domain Intent** based on the current view and selection."

> **Dev:** "When Shift is held, are the lit pads or buttons commands?"
> **Domain expert:** "No. They are **Surface Hints** for possible **Domain Intents** until the performer completes a Hardware Input combination."

> **Dev:** "How many scenes should the first Overture model support?"
> **Domain expert:** "Start with eight **Overture Scenes** to match the visible columns. Add **Scene Pages** later if needed."

> **Dev:** "Do clip cells only exist after clips are created?"
> **Domain expert:** "No. **Clip Cells** are structural grid positions. An initial **Overture Project** has 64 of them, and each may be empty or contain one **Overture Clip**."

> **Dev:** "Is a clip identified by its grid position?"
> **Domain expert:** "No. A **Clip Cell** has a **Clip Cell Coordinate**; an **Overture Clip** has a stable **Clip ID**."

> **Dev:** "Does duplicating a clip reuse its ID?"
> **Domain expert:** "No. **Clip ID** is immutable object identity. Duplicates get new **Clip IDs**."

> **Dev:** "Is Track 1 stored as trackIndex 1?"
> **Domain expert:** "No. **Track Index** is zero-based internally; **Track Number** is the one-based label shown to users."

> **Dev:** "Do Tracks need stable IDs like Clips?"
> **Domain expert:** "No. Tracks are structural positions in the initial architecture, so **Track Index** is their identity."

> **Dev:** "Do Scenes need stable IDs like Clips?"
> **Domain expert:** "No. Scenes are structural columns in the initial architecture, so **Scene Index** is their identity."

> **Dev:** "Does Track Bank 2 shift the scene columns?"
> **Domain expert:** "No. **Track Bank** changes visible rows only; **Overture Scene** columns remain stable."

> **Dev:** "Do track buttons select clips in Session View?"
> **Domain expert:** "No. Track buttons perform **Track Selection**; pads select **Clip Cells**."

> **Dev:** "If I select a clip cell on Track 6, what is the selected track?"
> **Domain expert:** "**Track Selection** becomes Track 6 because **Selected Clip Cell** determines the current track for editing."

> **Dev:** "Can the selected clip cell be hidden when returning to Session View?"
> **Domain expert:** "Not by default. The visible **Track Bank** follows **Track Selection** so the selected row is visible."

> **Dev:** "Can one native **Move Set** contain multiple **Overture Projects**?"
> **Domain expert:** "No. Treat the relationship as one **Overture Project** per **Move Set** context."

> **Dev:** "Should Overture show all eight tracks at once?"
> **Domain expert:** "No. Move's surface exposes four rows, so Overture addresses eight **Tracks** as two **Track Banks**."

> **Dev:** "Should the two track banks be called the Move bank and Schwung bank?"
> **Domain expert:** "No. Routes are user-changeable. Use **Track Bank 1** for Tracks 1-4 and **Track Bank 2** for Tracks 5-8."

> **Dev:** "Does launching a scene only affect the visible track bank?"
> **Domain expert:** "No. An **Overture Scene** launches across all eight **Tracks**; **Track Bank** only affects which tracks are visible or directly addressed."

> **Dev:** "If a scene has no clip on Track 6, should Track 6 keep playing?"
> **Domain expert:** "No. An **Empty Clip Cell** stops its **Track** when that **Overture Scene** is launched."

> **Dev:** "Is a clip with no notes the same as an empty cell?"
> **Domain expert:** "No. An **Empty Overture Clip** exists and owns an empty **Sequence**. An **Empty Clip Cell** has no clip."

> **Dev:** "What happens when an empty clip is launched?"
> **Domain expert:** "An **Empty Overture Clip** becomes the **Playing Clip** for its **Track** and plays silence."

> **Dev:** "Does selecting an empty cell create a clip?"
> **Domain expert:** "No. Selecting an **Empty Clip Cell** only focuses it; recording, capture, sequencing, or an explicit new-clip command creates the **Overture Clip**."

> **Dev:** "Should we call the current cell focused or selected?"
> **Domain expert:** "Use **Selected Clip Cell**. Focus is UI implementation language, while selected matches Move's musical workflow language."

> **Dev:** "Can each track have its own selected clip?"
> **Domain expert:** "No. Overture runtime/control context has one **Selected Clip Cell**, which points into the **Overture Project** and determines the current track and scene position for editing."

> **Dev:** "Can a performer launch one clip without launching the whole scene?"
> **Domain expert:** "Yes. A **Clip Launch** affects one **Track**; a **Scene Launch** affects all eight **Tracks**."

> **Dev:** "If transport is already running, does a launched clip start immediately?"
> **Domain expert:** "No. By default it becomes queued and starts at the next bar **Launch Boundary**."

> **Dev:** "Should we store the currently playing scene?"
> **Domain expert:** "No. Store **Playing Clip** per **Track**. A playing scene is only a derived view when the playing clips line up with one **Overture Scene**."

> **Dev:** "Should playing state point at a grid coordinate?"
> **Domain expert:** "No. **Playing Clip** and **Queued Clip** state reference **Clip ID**; view code can derive the current **Clip Cell Coordinate**."

> **Dev:** "If a playing clip is moved to another cell, does it stop?"
> **Domain expert:** "No. A **Playing Clip** keeps playing by **Clip ID** and appears at its new **Clip Cell Coordinate**."

> **Dev:** "If we duplicate a playing clip, does the duplicate start playing?"
> **Domain expert:** "No. The duplicate gets a new **Clip ID** and must be launched explicitly."

> **Dev:** "Can paste replace an existing clip?"
> **Domain expert:** "Yes. **Overwrite Clip** replaces the existing clip; if the overwritten clip was playing or queued, that playback or queue state is cleared."

> **Dev:** "If we delete the clip that is currently playing, does it wait for the next launch boundary?"
> **Domain expert:** "No. Deleting a **Playing Clip** stops its **Track** immediately."

> **Dev:** "What if the deleted clip was queued but not playing?"
> **Domain expert:** "Deleting a **Queued Clip** clears that **Track**'s queued launch without stopping the current **Playing Clip**."

> **Dev:** "Is an **Overture Scene** the same thing as a native Move scene?"
> **Domain expert:** "No. A **Move Scene** groups native **Move Clips** across Move tracks, while an **Overture Scene** groups **Overture Clips** across Overture **Tracks**."

> **Dev:** "If we launch an **Overture Scene**, are we launching one clip or a column of clips?"
> **Domain expert:** "A column. An **Overture Scene** groups up to one **Overture Clip** per **Track**."

> **Dev:** "Does changing scenes replace the tracks?"
> **Domain expert:** "No. **Tracks** stay global across **Overture Scenes**. Scenes choose which **Overture Clips** play on those tracks."

> **Dev:** "Are Tracks 1-4 always Move and Tracks 5-8 always Schwung?"
> **Domain expert:** "No. That is the **Default Route Template**. Each **Track** has a user-changeable **Track Route**."

> **Dev:** "Should a route to native Move be called a MIDI route?"
> **Domain expert:** "No. Use **Move Route** for the domain term; MIDI is the host transport detail."

> **Dev:** "Does Overture Track 5 become native Move Track 5 when rerouted?"
> **Domain expert:** "No. A **Move Route** has a **Move Track Target**, and native Move has four **Move Tracks**."

> **Dev:** "Does a Move-routed track own the native instrument settings?"
> **Domain expert:** "No. Overture owns the **Move Track Target** selection, but native Move owns the sound state behind it."

> **Dev:** "Can two Overture tracks target the same native Move track?"
> **Domain expert:** "Yes, but that is a **Route Conflict** warning, not an invalid project."

> **Dev:** "Is the Synth slot a component?"
> **Domain expert:** "Use **Component** for the sound-chain role and **Slot** for the concrete Schwung runtime assignment."

> **Dev:** "If a **Track** changes from a Move route to a Schwung route, do we keep its notes?"
> **Domain expert:** "Yes. Notes and timing are **Route-Neutral Track Data**. Sound choices and destination parameters are **Route-Specific Track Data**."

> **Dev:** "If a **Track** changes away from a Schwung route, do we delete its chain?"
> **Domain expert:** "No. Save it as **Inactive Route Data** in the **Overture Project** so the route can be restored."

> **Dev:** "Should this Track's step grid be called a pattern?"
> **Domain expert:** "No. The domain term is **Sequence** because the musical content may grow beyond a fixed grid. Each **Overture Clip** owns its **Sequence**."

> **Dev:** "Where does automation live?"
> **Domain expert:** "Use **Motion**. **Sequence Motion** belongs to the clip's route-neutral **Sequence**; **Route Motion** belongs to the clip but targets route-specific parameters."

> **Dev:** "If a track is rerouted, do we delete clip motion targeting the old route?"
> **Domain expert:** "No. Inactive **Route Motion** is retained with its **Overture Clip** so it can be restored when the route is compatible again."

> **Dev:** "If a module changes and a motion target disappears, should we delete the motion?"
> **Domain expert:** "No. Keep it as **Unmapped Motion** until it is remapped or explicitly deleted."

> **Dev:** "How long is a bar in the initial step sequencer?"
> **Domain expert:** "A **Bar** spans 16 **Steps**."

> **Dev:** "Should timing nudges be stored as fractional steps?"
> **Domain expert:** "No. **Step** is the musical grid position; **Tick** is the internal timing subdivision."

> **Dev:** "When the user creates a clip, should we copy the selected clip?"
> **Domain expert:** "No. That is a **Duplicate Overture Clip** command. A **New Overture Clip** starts empty or from defaults."

> **Dev:** "Is an empty Session View position a slot?"
> **Domain expert:** "No. Use **Clip Cell**. It is an addressable Overture Session View position that may be empty or contain one **Overture Clip**."

> **Dev:** "Is the active clip the one we are editing or the one currently playing?"
> **Domain expert:** "Say **Selected Clip** for editing focus, **Playing Clip** for playback, and **Queued Clip** for a pending launch."

## Flagged Ambiguities

- "Clip" can mean a native Ableton Move clip or an Overture-owned per-track container. Resolved: use **Move Clip** for the native concept and **Overture Clip** when the distinction matters.
- "Scene" can mean a native Ableton Move scene or an Overture-owned column across tracks. Resolved: use **Move Scene** for the native concept and **Overture Scene** when the distinction matters.
- "Set" means a native Ableton Move container. Resolved: use **Move Set** for the native concept and **Overture Project** for Overture's top-level owned state.
- "Note View" risks confusion with native **Move Note Mode**. Resolved: use **Track View** for Overture.
- Bank names must not imply fixed routing. Resolved: use **Track Bank 1** and **Track Bank 2**, not Move Bank or Schwung Bank.
- "Track" can mean a native Move track or an Overture-owned routed musical part. Resolved: use **Track** for Overture-owned parts in Overture context, and **Move Track** when referring to the native Move concept.
- "Route" could imply a fixed track type. Resolved: a **Track Route** is user-changeable, while the **Track** keeps its musical identity.
- Track data can mean composition data or destination settings. Resolved: **Route-Neutral Track Data** stays with the **Track**, while **Route-Specific Track Data** belongs to the current **Track Route**.
- Inactive route settings should not be confused with deleted settings. Resolved: **Inactive Route Data** is retained for restoration.
- "Pattern" appears in the current `overture-next` implementation. Resolved: **Sequence** is the domain term; Pattern is implementation vocabulary until deliberately renamed.
- "Pulse" can mean a MIDI clock pulse. Resolved: use **Tick** for Overture's internal timing subdivision.
- "Slot" is reserved for Schwung runtime routing. Resolved: use **Clip Cell** for Overture Session View positions.
- "Active Clip" is ambiguous between edit focus, playback, and launch state. Resolved: use **Selected Clip**, **Playing Clip**, or **Queued Clip**.
- "Focused" sounds like UI implementation state. Resolved: use **Selected** for domain objects and reserve focus language for UI mechanics if needed.
