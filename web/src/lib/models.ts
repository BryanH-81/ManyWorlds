export type Choice = { id: string; text: string; to?: string };


export type StoryNode = {
id: string;
title: string;
content: string; // 400-600 words
choices: Choice[];
};


export type Story = {
id: string;
title: string;
rootId: string;
nodes: Record<string, StoryNode>;
};
