"use client";

import { useState, useCallback } from "react";

export interface SubtaskTreeNode {
  title: string;
  children: SubtaskTreeNode[];
}

interface SubtaskTreeBuilderProps {
  nodes: SubtaskTreeNode[];
  onChange: (nodes: SubtaskTreeNode[]) => void;
  maxDepth?: number;
}

export function SubtaskTreeBuilder({ nodes, onChange, maxDepth = 5 }: SubtaskTreeBuilderProps) {
  const [rootInput, setRootInput] = useState("");

  const addRoot = useCallback(() => {
    if (!rootInput.trim()) return;
    onChange([...nodes, { title: rootInput.trim(), children: [] }]);
    setRootInput("");
  }, [rootInput, nodes, onChange]);

  const removeNode = useCallback((path: number[]) => {
    const next = structuredClone(nodes);
    let parent = { children: next } as { children: SubtaskTreeNode[] };
    for (let i = 0; i < path.length - 1; i++) {
      parent = parent.children[path[i]!]!;
    }
    parent.children.splice(path[path.length - 1]!, 1);
    onChange(next);
  }, [nodes, onChange]);

  const addChild = useCallback((path: number[], title: string) => {
    const next = structuredClone(nodes);
    let target = { children: next } as { children: SubtaskTreeNode[] };
    for (const idx of path) {
      target = target.children[idx]!;
    }
    target.children.push({ title, children: [] });
    onChange(next);
  }, [nodes, onChange]);

  return (
    <div>
      {nodes.length > 0 && (
        <div className="space-y-0.5 mb-2">
          {nodes.map((node, idx) => (
            <TreeNodeRow
              key={idx}
              node={node}
              path={[idx]}
              depth={0}
              maxDepth={maxDepth}
              onRemove={removeNode}
              onAddChild={addChild}
            />
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          type="text"
          value={rootInput}
          onChange={(e) => setRootInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && rootInput.trim()) {
              e.preventDefault();
              addRoot();
            }
          }}
          placeholder="Add a subtask and press Enter..."
          className="flex-1 text-xs px-2 py-1.5 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400/50"
        />
        <button
          type="button"
          onClick={addRoot}
          disabled={!rootInput.trim()}
          className="px-2 py-1.5 text-xs text-gray-600 border rounded-md hover:bg-gray-50 disabled:opacity-50"
        >
          Add
        </button>
      </div>
    </div>
  );
}

function TreeNodeRow({
  node,
  path,
  depth,
  maxDepth,
  onRemove,
  onAddChild,
}: {
  node: SubtaskTreeNode;
  path: number[];
  depth: number;
  maxDepth: number;
  onRemove: (path: number[]) => void;
  onAddChild: (path: number[], title: string) => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [childInput, setChildInput] = useState("");
  const canNest = depth < maxDepth - 1;

  const handleAddChild = useCallback(() => {
    if (!childInput.trim()) return;
    onAddChild(path, childInput.trim());
    setChildInput("");
    setShowAdd(false);
  }, [childInput, path, onAddChild]);

  return (
    <div style={{ marginLeft: depth * 16 }}>
      <div className="flex items-center gap-1.5 text-xs bg-gray-50 rounded px-2 py-1.5 border group">
        {/* Indent indicator */}
        {depth > 0 && (
          <span className="text-gray-300 flex-shrink-0">└</span>
        )}
        <svg className="w-3 h-3 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="flex-1 text-gray-700 truncate">{node.title}</span>

        {/* Add child button */}
        {canNest && (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-blue-600 flex-shrink-0 transition-opacity"
            title="Add nested subtask"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        )}

        {/* Remove button */}
        <button
          type="button"
          onClick={() => onRemove(path)}
          className="text-gray-400 hover:text-red-500 flex-shrink-0"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Children */}
      {node.children.map((child, idx) => (
        <TreeNodeRow
          key={idx}
          node={child}
          path={[...path, idx]}
          depth={depth + 1}
          maxDepth={maxDepth}
          onRemove={onRemove}
          onAddChild={onAddChild}
        />
      ))}

      {/* Inline add child input */}
      {showAdd && (
        <div className="flex items-center gap-1.5 mt-0.5" style={{ marginLeft: 16 }}>
          <input
            type="text"
            autoFocus
            value={childInput}
            onChange={(e) => setChildInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); handleAddChild(); }
              if (e.key === "Escape") { setShowAdd(false); setChildInput(""); }
            }}
            placeholder="Nested subtask title..."
            className="flex-1 px-2 py-1 text-xs border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400/50"
          />
          <button
            type="button"
            onClick={handleAddChild}
            disabled={!childInput.trim()}
            className="px-2 py-1 text-[10px] font-medium text-white bg-blue-600 rounded disabled:opacity-50"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => { setShowAdd(false); setChildInput(""); }}
            className="px-1 py-1 text-[10px] text-gray-400 hover:text-gray-600"
          >
            &times;
          </button>
        </div>
      )}
    </div>
  );
}

/** Flatten a subtask tree into ordered (title, parentIndex) pairs for sequential API creation */
export function flattenSubtaskTree(nodes: SubtaskTreeNode[]): Array<{ title: string; parentOffset: number | null }> {
  const result: Array<{ title: string; parentOffset: number | null }> = [];

  function walk(children: SubtaskTreeNode[], parentIdx: number | null) {
    for (const child of children) {
      const myIdx = result.length;
      result.push({ title: child.title, parentOffset: parentIdx });
      walk(child.children, myIdx);
    }
  }
  walk(nodes, null);
  return result;
}
