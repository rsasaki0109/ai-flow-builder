import {
  findNodeSpec,
  hasCycle,
  isPortDataTypeCompatible,
  type FlowGraph,
  type PortSpec,
} from "@ai-flow-builder/flow-core";

export interface ConnectionDraft {
  source: {
    nodeId: string;
    portId: string | null;
  };
  target: {
    nodeId: string;
    portId: string | null;
  };
}

export type ConnectionValidationCode =
  | "CONNECTION_ENDPOINT_MISSING"
  | "CONNECTION_SOURCE_NODE_NOT_FOUND"
  | "CONNECTION_TARGET_NODE_NOT_FOUND"
  | "CONNECTION_SOURCE_PORT_NOT_FOUND"
  | "CONNECTION_TARGET_PORT_NOT_FOUND"
  | "CONNECTION_SOURCE_PORT_DIRECTION_INVALID"
  | "CONNECTION_TARGET_PORT_DIRECTION_INVALID"
  | "CONNECTION_PORT_TYPE_MISMATCH"
  | "CONNECTION_SELF_LOOP"
  | "CONNECTION_DUPLICATE_TARGET"
  | "CONNECTION_DUPLICATE_EDGE"
  | "CONNECTION_CREATES_CYCLE";

export type ConnectionValidationResult =
  | {
      status: "valid";
      source: {
        nodeId: string;
        portId: string;
      };
      target: {
        nodeId: string;
        portId: string;
      };
    }
  | {
      status: "invalid";
      code: ConnectionValidationCode;
      message: string;
    };

export function validateConnection(
  graph: FlowGraph,
  connection: ConnectionDraft,
): ConnectionValidationResult {
  if (connection.source.portId === null || connection.target.portId === null) {
    return invalid(
      "CONNECTION_ENDPOINT_MISSING",
      "Both connection handles are required.",
    );
  }

  const sourceNode = graph.nodes.find(
    (node) => node.id === connection.source.nodeId,
  );
  const targetNode = graph.nodes.find(
    (node) => node.id === connection.target.nodeId,
  );

  if (sourceNode === undefined) {
    return invalid(
      "CONNECTION_SOURCE_NODE_NOT_FOUND",
      "The source node no longer exists.",
    );
  }

  if (targetNode === undefined) {
    return invalid(
      "CONNECTION_TARGET_NODE_NOT_FOUND",
      "The target node no longer exists.",
    );
  }

  if (sourceNode.id === targetNode.id) {
    return invalid("CONNECTION_SELF_LOOP", "A node cannot connect to itself.");
  }

  const sourceSpec = findNodeSpec(sourceNode.kind, sourceNode.specVersion);
  const targetSpec = findNodeSpec(targetNode.kind, targetNode.specVersion);
  const sourcePort =
    sourceSpec === null
      ? undefined
      : findPort(
          [...sourceSpec.inputs, ...sourceSpec.outputs],
          connection.source.portId,
        );
  const targetPort =
    targetSpec === null
      ? undefined
      : findPort(
          [...targetSpec.inputs, ...targetSpec.outputs],
          connection.target.portId,
        );

  if (sourcePort === undefined) {
    return invalid(
      "CONNECTION_SOURCE_PORT_NOT_FOUND",
      `Source port "${connection.source.portId}" does not exist.`,
    );
  }

  if (targetPort === undefined) {
    return invalid(
      "CONNECTION_TARGET_PORT_NOT_FOUND",
      `Target port "${connection.target.portId}" does not exist.`,
    );
  }

  if (sourcePort.direction !== "output") {
    return invalid(
      "CONNECTION_SOURCE_PORT_DIRECTION_INVALID",
      "Connections must start from an output port.",
    );
  }

  if (targetPort.direction !== "input") {
    return invalid(
      "CONNECTION_TARGET_PORT_DIRECTION_INVALID",
      "Connections must end at an input port.",
    );
  }

  if (!isPortDataTypeCompatible(sourcePort.dataType, targetPort.dataType)) {
    return invalid(
      "CONNECTION_PORT_TYPE_MISMATCH",
      `Cannot connect ${sourcePort.dataType} to ${targetPort.dataType}.`,
    );
  }

  const duplicateEdge = graph.edges.some(
    (edge) =>
      edge.source.nodeId === sourceNode.id &&
      edge.source.portId === connection.source.portId &&
      edge.target.nodeId === targetNode.id &&
      edge.target.portId === connection.target.portId,
  );

  if (duplicateEdge) {
    return invalid(
      "CONNECTION_DUPLICATE_EDGE",
      "This connection already exists.",
    );
  }

  const targetAlreadyConnected = graph.edges.some(
    (edge) =>
      edge.target.nodeId === targetNode.id &&
      edge.target.portId === connection.target.portId,
  );

  if (targetAlreadyConnected) {
    return invalid(
      "CONNECTION_DUPLICATE_TARGET",
      "This input port already has a connection.",
    );
  }

  const nextGraph = {
    ...graph,
    edges: [
      ...graph.edges,
      {
        id: "00000000-0000-4000-8000-000000000000",
        source: {
          nodeId: sourceNode.id,
          portId: connection.source.portId,
        },
        target: {
          nodeId: targetNode.id,
          portId: connection.target.portId,
        },
      },
    ],
  };

  if (hasCycle(nextGraph)) {
    return invalid(
      "CONNECTION_CREATES_CYCLE",
      "This connection would create a cycle.",
    );
  }

  return {
    status: "valid",
    source: {
      nodeId: sourceNode.id,
      portId: connection.source.portId,
    },
    target: {
      nodeId: targetNode.id,
      portId: connection.target.portId,
    },
  };
}

function findPort(
  ports: readonly PortSpec[],
  portId: string,
): PortSpec | undefined {
  return ports.find((port) => port.id === portId);
}

function invalid(
  code: ConnectionValidationCode,
  message: string,
): ConnectionValidationResult {
  return {
    code,
    message,
    status: "invalid",
  };
}
