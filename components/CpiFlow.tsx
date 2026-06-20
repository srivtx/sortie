'use client';

import { useMemo, useCallback, useEffect } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  Handle,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { ExecutionStep } from '@/lib/ir/types';
import { shorten } from '@/lib/utils';
import { Box, Cpu, AlertCircle, CheckCircle2, Layers } from 'lucide-react';
import { useTheme } from './ThemeToggle';

interface CpiFlowProps {
  steps: ExecutionStep[];
}

function CpiNode({ data }: { data: NodeData }) {
  const { step } = data;
  const isFailed = step.result === 'failure';
  const isRoot = step.depth === 0;

  const borderColor = isFailed
    ? 'border-red'
    : isRoot
      ? 'border-purple'
      : 'border-line';

  const bgColor = isFailed
    ? 'bg-red/10'
    : isRoot
      ? 'bg-purple/5'
      : 'bg-surface';

  return (
    <div className={`rounded border ${borderColor} ${bgColor} px-2.5 py-1.5 min-w-[200px] shadow-sm font-mono`}>
      <Handle type="target" position={Position.Top} className="!bg-line2 !w-1.5 !h-1.5" />

      <div className="flex items-center gap-1.5 mb-1">
        {isFailed ? (
          <AlertCircle className="w-3 h-3 text-red" />
        ) : (
          <CheckCircle2 className="w-3 h-3 text-green" />
        )}
        <span className={`font-semibold text-xs truncate ${isFailed ? 'text-red' : 'text-ink'}`}>
          {step.program.shortName}
        </span>
        <span className="text-[9px] text-mute ml-auto">#{step.order}</span>
      </div>

      <div className="text-[10px] text-dim mb-0.5 truncate">
        {step.instruction.type}
      </div>

      {step.instruction.semanticSummary && (
        <div className="text-[10px] text-purple mb-1 truncate">
          {step.instruction.semanticSummary}
        </div>
      )}

      <div className="flex items-center gap-2 text-[9px] text-mute">
        {step.depth > 0 && (
          <span className="flex items-center gap-0.5">
            <Layers className="w-2.5 h-2.5" />
            d{step.depth}
          </span>
        )}
        {step.computeUnits && (
          <span className="flex items-center gap-0.5 text-green">
            <Cpu className="w-2.5 h-2.5" />
            {step.computeUnits.consumed.toLocaleString()}
          </span>
        )}
        {step.children.length > 0 && (
          <span className="flex items-center gap-0.5">
            <Box className="w-2.5 h-2.5" />
            {step.children.length}
          </span>
        )}
      </div>

      {isFailed && step.error && (
        <div className="mt-1 text-[9px] text-red bg-red/10 border border-red/20 rounded px-1.5 py-0.5">
          {step.error.name}: {shorten(step.error.rawMessage, 24)}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className="!bg-line2 !w-1.5 !h-1.5" />
    </div>
  );
}

interface NodeData {
  step: ExecutionStep;
}

const nodeTypes = {
  cpiNode: CpiNode,
};

export default function CpiFlow({ steps }: CpiFlowProps) {
  return (
    <div style={{ height: 600 }} className="w-full">
      <ReactFlowProvider>
        <CpiFlowInner steps={steps} />
      </ReactFlowProvider>
    </div>
  );
}

function CpiFlowInner({ steps }: CpiFlowProps) {
  const theme = useTheme();

  const { initialNodes, initialEdges } = useMemo(() => {
    const nodes: Node<NodeData>[] = [];
    const edges: Edge[] = [];

    const nodeWidth = 220;
    const levelGap = 150;
    const siblingGap = 240;

    const successColor = theme === 'light' ? '#059669' : '#14F195';
    const failColor = theme === 'light' ? '#dc2626' : '#ef4444';

    function buildTree(
      step: ExecutionStep,
      level: number,
      index: number,
      siblingCount: number,
      parentX: number
    ): { x: number; width: number } {
      let x: number;
      if (siblingCount === 1) {
        x = parentX;
      } else {
        const totalWidth = (siblingCount - 1) * siblingGap;
        const startX = parentX - totalWidth / 2;
        x = startX + index * siblingGap;
      }

      const y = level * levelGap;

      nodes.push({
        id: step.id,
        type: 'cpiNode',
        position: { x, y },
        data: { step },
      });

      if (step.parentId) {
        edges.push({
          id: `${step.parentId}-${step.id}`,
          source: step.parentId,
          target: step.id,
          type: 'smoothstep',
          animated: step.result === 'success',
          style: {
            stroke: step.result === 'failure' ? failColor : successColor,
            strokeWidth: 1.5,
            opacity: 0.7,
          },
        });
      }

      let subtreeWidth = 0;
      if (step.children.length > 0) {
        const childWidths: number[] = [];
        for (let i = 0; i < step.children.length; i++) {
          const result = buildTree(
            step.children[i],
            level + 1,
            i,
            step.children.length,
            x
          );
          childWidths.push(result.width);
        }
        subtreeWidth = childWidths.reduce((a, b) => a + b, 0) +
          (step.children.length - 1) * siblingGap;
      } else {
        subtreeWidth = nodeWidth;
      }

      return { x, width: subtreeWidth };
    }

    let rootX = 0;
    for (let i = 0; i < steps.length; i++) {
      const result = buildTree(steps[i], 0, i, steps.length, rootX);
      rootX += result.width + siblingGap;
    }

    const minX = Math.min(...nodes.map(n => n.position.x));
    const offsetX = Math.abs(minX) + 50;
    nodes.forEach(n => {
      n.position.x += offsetX;
    });

    return { initialNodes: nodes, initialEdges: edges };
  }, [steps, theme]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const { fitView } = useReactFlow();

  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
    if (initialNodes.length > 0) {
      const t = setTimeout(() => fitView({ padding: 0.15, duration: 300 }), 50);
      return () => clearTimeout(t);
    }
  }, [initialNodes, initialEdges, setNodes, setEdges, fitView]);

  const miniColors = {
    fail: theme === 'light' ? '#dc2626' : '#ef4444',
    root: theme === 'light' ? '#7c3aed' : '#9945FF',
    success: theme === 'light' ? '#059669' : '#14F195',
  };

  return (
    <div className="bg-bg border border-line rounded overflow-hidden" style={{ height: 600 }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={24} size={1} />
        <Controls showInteractive={false} />
        <MiniMap
          nodeStrokeWidth={2}
          nodeColor={(n: any) => {
            const step = n.data?.step;
            if (step?.result === 'failure') return miniColors.fail;
            if (step?.depth === 0) return miniColors.root;
            return miniColors.success;
          }}
          zoomable
          pannable
        />
      </ReactFlow>
    </div>
  );
}
