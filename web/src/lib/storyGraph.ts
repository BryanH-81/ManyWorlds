import type { Story, StoryNode } from "./models";


export function createEmptyStory(title = "Untitled Story"): Story {
const root: StoryNode = {
id: crypto.randomUUID(),
title: "Chapter 1",
content: "Start your journey…",
choices: [],
};
return {
id: crypto.randomUUID(),
title,
rootId: root.id,
nodes: { [root.id]: root },
};
}


export function addNode(story: Story, node: StoryNode) {
story.nodes[node.id] = node;
}


export function linkChoice(
story: Story,
fromId: string,
choiceIndex: number,
toId: string,
) {
const node = story.nodes[fromId];
if (!node) return;
node.choices[choiceIndex] = { ...node.choices[choiceIndex], to: toId };
}

// Utility and immutable helpers appended for safer graph manipulation
export function generateId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof (crypto as any).randomUUID === "function") {
      return (crypto as any).randomUUID();
    }
  } catch {}
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function addNodeImmutable(story: Story, node: StoryNode): Story {
  return { ...story, nodes: { ...story.nodes, [node.id]: node } };
}

export function linkChoiceImmutable(
  story: Story,
  fromId: string,
  choiceIndex: number,
  toId: string,
): Story {
  const from = story.nodes[fromId];
  const to = story.nodes[toId];
  if (!from || !to) return story;
  if (!from.choices[choiceIndex]) return story;
  const updatedFrom: StoryNode = {
    ...from,
    choices: from.choices.map((c, i) => (i === choiceIndex ? { ...c, to: toId } : c)),
  };
  return { ...story, nodes: { ...story.nodes, [fromId]: updatedFrom } };
}

export function addChoice(
  story: Story,
  fromId: string,
  text: string,
): { story: Story; choiceId: string } {
  const from = story.nodes[fromId];
  if (!from) return { story, choiceId: "" };
  const choiceId = generateId();
  const updatedFrom: StoryNode = {
    ...from,
    choices: [...from.choices, { id: choiceId, text }],
  };
  return { story: { ...story, nodes: { ...story.nodes, [fromId]: updatedFrom } }, choiceId };
}

export function linkChoiceById(
  story: Story,
  fromId: string,
  choiceId: string,
  toId: string,
): Story {
  const from = story.nodes[fromId];
  const to = story.nodes[toId];
  if (!from || !to) return story;
  const updatedFrom: StoryNode = {
    ...from,
    choices: from.choices.map((c) => (c.id === choiceId ? { ...c, to: toId } : c)),
  };
  return { ...story, nodes: { ...story.nodes, [fromId]: updatedFrom } };
}
