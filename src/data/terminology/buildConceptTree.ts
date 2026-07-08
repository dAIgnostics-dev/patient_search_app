import type { TerminologyConcept, TerminologyOption } from './types';

function cloneConcept(concept: TerminologyConcept): TerminologyConcept {
  return {
    code: concept.code,
    display: concept.display,
    parentId: concept.parentId,
    notSelectable: concept.notSelectable,
    children: [],
  };
}

export function buildConceptTree(concepts: TerminologyConcept[]): TerminologyConcept[] {
  const byCode = new Map<string, TerminologyConcept>();
  const roots: TerminologyConcept[] = [];

  for (const concept of concepts) {
    if (!concept.code.trim()) continue;
    byCode.set(concept.code, cloneConcept(concept));
  }

  for (const concept of byCode.values()) {
    if (!concept.parentId) {
      roots.push(concept);
      continue;
    }

    const parent = byCode.get(concept.parentId);
    if (!parent) {
      roots.push(concept);
      continue;
    }
    parent.children = parent.children ?? [];
    parent.children.push(concept);
  }

  return roots;
}

function flattenTreeInto(
  nodes: TerminologyConcept[],
  system: string,
  out: TerminologyOption[],
): void {
  for (const node of nodes) {
    if (!node.notSelectable) {
      out.push({
        code: node.code,
        display: node.display,
        system,
      });
    }
    if (node.children?.length) {
      flattenTreeInto(node.children, system, out);
    }
  }
}

export function toFlatSelectableOptions(tree: TerminologyConcept[], system: string): TerminologyOption[] {
  const out: TerminologyOption[] = [];
  flattenTreeInto(tree, system, out);
  return out;
}

function findNode(nodes: TerminologyConcept[], code: string): TerminologyConcept | null {
  for (const node of nodes) {
    if (node.code === code) return node;
    const nested = node.children?.length ? findNode(node.children, code) : null;
    if (nested) return nested;
  }
  return null;
}

export function getChildren(tree: TerminologyConcept[], parentCode: string): TerminologyConcept[] {
  const parent = findNode(tree, parentCode.trim());
  return parent?.children ?? [];
}
