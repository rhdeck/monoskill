# Monoskill YouTube video — Descript recording script

Working title: **Stop Installing AI Skills One at a Time**  
Thumbnail line: **MANY SKILLS. ONE WAY IN.**  
Target length: 2:30–3:00

This draft is edited from Ray's own language while defining Monoskill: “packaging up lots of little skills and putting them into a single skill,” “the same ease of use,” and “if somebody finds something, then we can say, ‘Hey, that looks like a pretty good skill. Let's pull it using Monoskill.’”

## 0:00 — Hook

**ON CAMERA**

AI skills are useful. Managing them one at a time isn't.

You find a repository with ten or twenty good skills. Now you have to install them, teach the AI when to reach for each one, keep track of where they came from, and somehow notice when the source changes.

That's the skill pile. Monoskill turns it into one way in.

**SCREEN**

Open on the Monoskill hero animation: many named skill fragments converging into one package.

## 0:24 — What Monoskill does

**ON CAMERA**

The whole idea behind Monoskill is packaging up lots of little skills and putting them into a single skill.

It builds a compact router at the top. The complete skills stay attached underneath it—scripts, references, assets, all of it. And it keeps the receipts: the source repository, the resolved commit, and hashes for every skill tree.

One skill for the AI to load. Nothing flattened. Nothing lost.

**SCREEN**

Show the package diagram, then cut to a built folder with `SKILL.md`, `references/`, and `provenance.json`.

## 0:55 — The useful moment

**ON CAMERA**

Here's the moment I wanted to make easy.

Somebody finds a repository and says, “Hey, that looks like a pretty good set of skills.” Instead of copying folders around or installing every skill one at a time, you pull the repository with Monoskill and give the collection a name.

**SCREEN — TYPE THIS**

```bash
npx --yes monoskill@0.3.2 add coreyhaines31/marketingskills \
  --name corey-marketing
```

**ON CAMERA**

By default it installs into the project you're working in. If you want it available across your harnesses, preview the global targets first, then install it explicitly.

**SCREEN — SHOW THE SITE GENERATOR**

Paste `coreyhaines31/marketingskills`, choose Project or Global, and copy either the command or the AI-ready prompt.

## 1:28 — Why the provenance matters

**ON CAMERA**

The package isn't a dead snapshot.

Monoskill knows where it came from. It can check for drift. It can update from the source. And it can produce a portable `.skill` archive when the output needs to be one file.

That changes the relationship. You're not copying a pile of prompts and hoping you remember what happened. You're managing a dependency—with a trail back to the source.

**SCREEN**

```bash
monoskill check ./corey-marketing
monoskill update ./corey-marketing
monoskill build coreyhaines31/marketingskills \
  --name corey-marketing \
  --archive ./corey-marketing.skill
```

## 1:58 — Why this matters for agents

**ON CAMERA**

Agents don't need every instruction in their face all the time. They need a small, direct trigger surface—and a reliable path to the deeper material when the job calls for it.

That's what Monoskill packages: one obvious front door, with the full building still behind it.

Many skills. One way in.

## 2:18 — Close

**ON CAMERA**

Monoskill is open source and free. It's a gift from State Change.

Go to monoskill.com. Paste a skill repository. Copy the command—or hand the generated prompt straight to your AI.

Then stop managing the skill pile.

**END CARD**

`monoskill.com`  
Free and open source  
A gift from State Change

## Pickup prompts for Ray

Record these as loose answers in Descript. They are the best raw material for replacing any connective tissue that still sounds written.

1. What happened that made installing skills one at a time feel broken?
2. What is the difference between a pile of skills and one Monoskill?
3. Why did keeping provenance matter enough to build it into the format?
4. Walk through the Corey Haines example as if you were showing it to a friend.
5. What do you hope somebody does five minutes after discovering Monoskill?

## Descript edit notes

- Cut the hook fast: face → animated convergence → terminal, inside the first eight seconds.
- Keep command captures large enough to read on a phone; highlight only the source and `--name` values.
- Use the site animation as the recurring visual metaphor. Return to it at “one obvious front door.”
- Remove pauses between the three short closing lines. Let “Then stop managing the skill pile” land without music underneath it.
