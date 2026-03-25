import { useCallback, useState, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  type NodeChange,
  type Connection,
  type Node,
  type Edge,
  BackgroundVariant,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { VariableNode } from '../Nodes/VariableNode';
import { EstimandCard } from '../Nodes/EstimandCard';
import { ModelCard } from '../Nodes/ModelCard';
import { CausalArrow } from '../Edges/CausalArrow';
import { VariableContextMenu } from '../ContextMenu/VariableContextMenu';
import { EdgeContextMenu } from '../ContextMenu/EdgeContextMenu';
import { CanvasContextMenu } from '../ContextMenu/CanvasContextMenu';
import { useEstiplanStore } from '../../store/useEstiplanStore';
import type { Variable, CausalEdgeData } from '../../types/dag';
import styles from './EstiplanCanvas.module.css';

// MUST be defined outside the component to avoid re-render issues
const nodeTypes = {
  variable: VariableNode,
  estimandCard: EstimandCard,
  modelCard: ModelCard,
};

const edgeTypes = {
  causalArrow: CausalArrow,
};

interface ContextMenuState {
  type: 'node' | 'edge' | 'canvas';
  id?: string;
  x: number;
  y: number;
  canvasX?: number;
  canvasY?: number;
}

export function EstiplanCanvas() {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(
    null,
  );

  // Read store values individually to avoid infinite re-render
  const variables = useEstiplanStore((s) => s.variables);
  const causalEdges = useEstiplanStore((s) => s.causalEdges);
  const estimands = useEstiplanStore((s) => s.estimands);
  const models = useEstiplanStore((s) => s.models);
  const nodePositions = useEstiplanStore((s) => s.nodePositions);
  const highlightedPaths = useEstiplanStore((s) => s.highlightedPaths);
  const highlightedModelId = useEstiplanStore((s) => s.highlightedModelId);
  const setNodePosition = useEstiplanStore((s) => s.setNodePosition);
  const addCausalEdge = useEstiplanStore((s) => s.addCausalEdge);
  const theme = useEstiplanStore((s) => s.theme);

  const defaultEdgeOptions = useMemo(
    () => ({
      type: 'causalArrow',
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 16,
        height: 16,
      },
    }),
    [],
  );

  // Derive React Flow nodes from store state
  const rfNodes = useMemo(() => {
    const nodes: Node[] = [];

    variables.forEach((variable: Variable) => {
      const pos = nodePositions[variable.id] || { x: 200, y: 200 };
      nodes.push({
        id: variable.id,
        type: 'variable',
        position: pos,
        data: { ...variable },
      });
    });

    estimands.forEach((estimand) => {
      const sourcePos = nodePositions[estimand.sourceId] || { x: 200, y: 200 };
      const targetPos = nodePositions[estimand.targetId] || { x: 300, y: 300 };
      const cardPos = nodePositions[estimand.id] || {
        x: (sourcePos.x + targetPos.x) / 2 + 150,
        y: (sourcePos.y + targetPos.y) / 2,
      };
      nodes.push({
        id: estimand.id,
        type: 'estimandCard',
        position: cardPos,
        data: { ...estimand },
      });
    });

    models.forEach((model) => {
      const estimandPos = nodePositions[model.estimandId] || {
        x: 400,
        y: 300,
      };
      const modelPos = nodePositions[model.id] || {
        x: estimandPos.x,
        y: estimandPos.y + 160,
      };
      nodes.push({
        id: model.id,
        type: 'modelCard',
        position: modelPos,
        data: { ...model },
      });
    });

    return nodes;
  }, [variables, estimands, models, nodePositions]);

  // Derive React Flow edges from store state
  const rfEdges = useMemo(() => {
    const highlightedEdgePairs = new Set<string>();
    const hasHighlighting = highlightedPaths !== null;

    if (highlightedPaths) {
      for (const path of highlightedPaths) {
        for (let i = 0; i < path.length - 1; i++) {
          highlightedEdgePairs.add(`${path[i]}->${path[i + 1]}`);
        }
      }
    }

    const edges: Edge[] = causalEdges.map((edge) => {
      const pairKey = `${edge.source}->${edge.target}`;
      const isHighlighted = highlightedEdgePairs.has(pairKey);
      const isDimmed = hasHighlighting && !isHighlighted;

      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: 'causalArrow',
        sourceHandle: null,
        targetHandle: null,
        data: {
          ...edge.data,
          isHighlighted,
          isDimmed,
        } as CausalEdgeData & { isHighlighted: boolean; isDimmed: boolean },
        animated: isHighlighted,
      };
    });

    // Add dashed connector edges on model card hover
    if (highlightedModelId) {
      const hoveredModel = models.find((m) => m.id === highlightedModelId);
      if (hoveredModel) {
        const dashedStyle = {
          strokeDasharray: '6 3',
          stroke: '#ffb347',
          strokeWidth: 1.5,
          opacity: 0.6,
        };

        // Dashed line from estimand card → model card
        edges.push({
          id: `connector-est-${hoveredModel.estimandId}-${hoveredModel.id}`,
          source: hoveredModel.estimandId,
          target: hoveredModel.id,
          type: 'default',
          style: dashedStyle,
          animated: false,
        });

        // Dashed line from treatment variable → model card
        edges.push({
          id: `connector-src-${hoveredModel.sourceId}-${hoveredModel.id}`,
          source: hoveredModel.sourceId,
          target: hoveredModel.id,
          type: 'default',
          style: dashedStyle,
          animated: false,
        });

        // Dashed line from outcome variable → model card
        edges.push({
          id: `connector-tgt-${hoveredModel.targetId}-${hoveredModel.id}`,
          source: hoveredModel.targetId,
          target: hoveredModel.id,
          type: 'default',
          style: dashedStyle,
          animated: false,
        });
      }
    }

    return edges;
  }, [causalEdges, highlightedPaths, models, highlightedModelId]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      for (const change of changes) {
        if (change.type === 'position' && change.position) {
          setNodePosition(change.id, change.position.x, change.position.y);
        }
      }
    },
    [setNodePosition],
  );

  const pushSnapshot = useEstiplanStore((s) => s.pushSnapshot);

  const onConnect = useCallback(
    (connection: Connection) => {
      if (connection.source && connection.target) {
        // addCausalEdge returns false for self-loops and duplicates
        addCausalEdge(connection.source, connection.target);
      }
    },
    [addCausalEdge],
  );

  const onNodeDragStop = useCallback(() => {
    // Push a history snapshot when the user finishes dragging a node
    pushSnapshot();
  }, [pushSnapshot]);

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      if (node.type === 'variable') {
        setContextMenu({
          type: 'node',
          id: node.id,
          x: event.clientX,
          y: event.clientY,
        });
      }
    },
    [],
  );

  const onEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      event.preventDefault();
      setContextMenu({
        type: 'edge',
        id: edge.id,
        x: event.clientX,
        y: event.clientY,
      });
    },
    [],
  );

  const onPaneContextMenu = useCallback(
    (event: React.MouseEvent | MouseEvent) => {
      event.preventDefault();
      const reactFlowBounds = (
        event.target as HTMLElement
      ).closest('.react-flow');
      const rect = reactFlowBounds?.getBoundingClientRect();
      setContextMenu({
        type: 'canvas',
        x: event.clientX,
        y: event.clientY,
        canvasX: rect ? event.clientX - rect.left : event.clientX,
        canvasY: rect ? event.clientY - rect.top : event.clientY,
      });
    },
    [],
  );

  const onPaneClick = useCallback(() => {
    setContextMenu(null);
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  return (
    <div className={styles.canvasWrapper}>
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        onNodesChange={onNodesChange}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        onNodeContextMenu={onNodeContextMenu}
        onEdgeContextMenu={onEdgeContextMenu}
        onPaneContextMenu={onPaneContextMenu}
        onPaneClick={onPaneClick}
        fitView
        deleteKeyCode="Delete"

      >
        {theme === 'whiteboard' && (
          <Background
            variant={BackgroundVariant.Dots}
            color="var(--estiplan-bg-pattern)"
            gap={20}
            size={1}
          />
        )}
        <Controls />
      </ReactFlow>

      {contextMenu?.type === 'node' && contextMenu.id && (
        <VariableContextMenu
          nodeId={contextMenu.id}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={closeContextMenu}
        />
      )}
      {contextMenu?.type === 'edge' && contextMenu.id && (
        <EdgeContextMenu
          edgeId={contextMenu.id}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={closeContextMenu}
        />
      )}
      {contextMenu?.type === 'canvas' && (
        <CanvasContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          canvasX={contextMenu.canvasX || 0}
          canvasY={contextMenu.canvasY || 0}
          onClose={closeContextMenu}
        />
      )}
    </div>
  );
}
