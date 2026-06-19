"use client";

import {
  aiTextGenerateConfigSchema,
  aiTextGenerateNodeSpec,
  getNodeSpec,
  MAX_NODE_LABEL_LENGTH,
  MAX_SYSTEM_PROMPT_LENGTH,
  MAX_TEMPLATE_LENGTH,
  MAX_TEXT_INPUT_DEFAULT_VALUE_LENGTH,
  textInputConfigSchema,
  textInputNodeSpec,
  textOutputConfigSchema,
  textOutputNodeSpec,
  textTemplateConfigSchema,
  textTemplateNodeSpec,
  type AiTextGenerateConfig,
  type FlowNode,
  type TextInputConfig,
} from "@ai-flow-builder/flow-core";
import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { useEditorStore } from "../store/index.js";

type FieldIssue = {
  readonly message: string;
  readonly path: readonly PropertyKey[];
};

type TextInputFormValues = {
  defaultValue: string;
  key: string;
  label: string;
  required: boolean;
};

type TextTemplateFormValues = {
  template: string;
};

type AiGenerateFormValues = {
  systemPrompt: string;
};

type TextOutputFormValues = {
  key: string;
  label: string;
};

export function NodeInspector() {
  const description = useEditorStore((store) => store.description);
  const flowId = useEditorStore((store) => store.flowId);
  const graph = useEditorStore((store) => store.graph);
  const selectedEdgeId = useEditorStore((store) => store.selectedEdgeId);
  const selectedNodeId = useEditorStore((store) => store.selectedNodeId);
  const selectedNode = useMemo(
    () => graph.nodes.find((node) => node.id === selectedNodeId) ?? null,
    [graph.nodes, selectedNodeId],
  );

  if (selectedNode === null) {
    return (
      <section aria-labelledby="inspector-heading">
        <h2 className="text-sm font-semibold" id="inspector-heading">
          Inspector
        </h2>
        <div className="mt-4 rounded-md border border-[var(--border)] bg-[var(--background)] p-3 text-sm text-[var(--muted)]">
          {selectedEdgeId === null
            ? "Select a node to edit its settings."
            : "Edge settings are not editable in the MVP."}
        </div>
        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="text-[var(--muted)]">Description</dt>
            <dd className="mt-1 leading-6">
              {description ?? "No description"}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Flow ID</dt>
            <dd className="mt-1 break-all font-mono text-xs">{flowId}</dd>
          </div>
        </dl>
      </section>
    );
  }

  const spec = getNodeSpec(selectedNode.kind, selectedNode.specVersion);

  return (
    <section aria-labelledby="inspector-heading" className="space-y-5">
      <div>
        <h2 className="text-sm font-semibold" id="inspector-heading">
          Inspector
        </h2>
        <p className="mt-1 text-xs text-[var(--muted)]">{spec.description}</p>
      </div>

      <CommonNodeFields node={selectedNode} />

      {selectedNode.kind === "core.input.text" ? (
        <TextInputSettings node={selectedNode} />
      ) : null}
      {selectedNode.kind === "core.text.template" ? (
        <TextTemplateSettings node={selectedNode} />
      ) : null}
      {selectedNode.kind === "ai.text.generate" ? (
        <AiGenerateSettings node={selectedNode} />
      ) : null}
      {selectedNode.kind === "core.output.text" ? (
        <TextOutputSettings node={selectedNode} />
      ) : null}
    </section>
  );
}

function CommonNodeFields({ node }: { node: FlowNode }) {
  const removeNodes = useEditorStore((store) => store.removeNodes);
  const updateNodeLabel = useEditorStore((store) => store.updateNodeLabel);
  const [draftLabel, setDraftLabel] = useState(node.label);
  const [labelError, setLabelError] = useState<string | null>(null);
  const labelId = useId();
  const labelErrorId = useId();
  const spec = getNodeSpec(node.kind, node.specVersion);

  useEffect(() => {
    setDraftLabel(node.label);
    setLabelError(null);
  }, [node.id, node.label]);

  const commitLabel = () => {
    const nextLabel = draftLabel.trim();

    if (nextLabel.length < 1 || nextLabel.length > MAX_NODE_LABEL_LENGTH) {
      setLabelError("Node label must be 1 to 80 characters.");
      return;
    }

    setLabelError(null);
    updateNodeLabel(node.id, nextLabel);
    setDraftLabel(nextLabel);
  };

  return (
    <section className="space-y-4 rounded-md border border-[var(--border)] bg-white p-3">
      <div>
        <h3 className="text-sm font-semibold">{spec.displayName}</h3>
        <dl className="mt-2 space-y-2 text-xs">
          <div>
            <dt className="text-[var(--muted)]">Node kind</dt>
            <dd className="mt-1 break-all font-mono">
              {node.kind}@{node.specVersion}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Node ID</dt>
            <dd className="mt-1 break-all font-mono">{node.id}</dd>
          </div>
        </dl>
      </div>

      <div>
        <label className="text-xs font-semibold" htmlFor={labelId}>
          Node label
        </label>
        <input
          aria-describedby={labelError === null ? undefined : labelErrorId}
          aria-invalid={labelError !== null}
          className="mt-1 h-9 w-full rounded-md border border-[var(--border)] px-3 text-sm"
          id={labelId}
          maxLength={MAX_NODE_LABEL_LENGTH + 1}
          onBlur={commitLabel}
          onChange={(event) => {
            setDraftLabel(event.currentTarget.value);
          }}
          value={draftLabel}
        />
        {labelError === null ? null : (
          <p className="mt-1 text-xs text-red-700" id={labelErrorId}>
            {labelError}
          </p>
        )}
      </div>

      <button
        className="h-9 w-full rounded-md border border-red-300 bg-white px-3 text-sm font-medium text-red-700"
        onClick={() => {
          removeNodes([node.id]);
        }}
        type="button"
      >
        Delete Node
      </button>
    </section>
  );
}

function TextInputSettings({ node }: { node: FlowNode }) {
  const updateNodeConfig = useEditorStore((store) => store.updateNodeConfig);
  const parsed = useMemo(
    () => textInputConfigSchema.safeParse(node.config),
    [node.config],
  );
  const initialConfig = parsed.success
    ? parsed.data
    : textInputNodeSpec.defaultConfig;
  const defaultValues = useMemo(
    () => toTextInputFormValues(initialConfig),
    [
      initialConfig.defaultValue,
      initialConfig.key,
      initialConfig.label,
      initialConfig.required,
    ],
  );
  const { getValues, register, reset } = useForm<TextInputFormValues>({
    defaultValues,
  });
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof TextInputFormValues, string>>
  >({});
  const keyId = useId();
  const labelId = useId();
  const requiredId = useId();
  const defaultValueId = useId();

  useEffect(() => {
    reset(defaultValues);
    setFieldErrors({});
  }, [defaultValues, reset]);

  const commit = (values: TextInputFormValues) => {
    const result = textInputConfigSchema.safeParse(
      toTextInputConfigCandidate(values),
    );

    if (!result.success) {
      setFieldErrors(
        collectFieldErrors(result.error.issues, [
          "key",
          "label",
          "defaultValue",
        ]),
      );
      return;
    }

    setFieldErrors({});
    updateNodeConfig(node.id, result.data);
  };

  const keyRegistration = register("key");
  const labelRegistration = register("label");
  const requiredRegistration = register("required");
  const defaultValueRegistration = register("defaultValue");

  return (
    <SettingsSection
      hasInvalidStoredConfig={!parsed.success}
      title="Text Input settings"
    >
      <div>
        <label className="text-xs font-semibold" htmlFor={keyId}>
          Input key
        </label>
        <input
          {...keyRegistration}
          aria-describedby={
            fieldErrors.key === undefined ? undefined : `${keyId}-error`
          }
          aria-invalid={fieldErrors.key !== undefined}
          className="mt-1 h-9 w-full rounded-md border border-[var(--border)] px-3 text-sm"
          id={keyId}
          onBlur={(event) => {
            void keyRegistration.onBlur(event);
            commit(getValues());
          }}
        />
        <FieldError fieldId={keyId} message={fieldErrors.key} />
      </div>

      <div>
        <label className="text-xs font-semibold" htmlFor={labelId}>
          Input label
        </label>
        <input
          {...labelRegistration}
          aria-describedby={
            fieldErrors.label === undefined ? undefined : `${labelId}-error`
          }
          aria-invalid={fieldErrors.label !== undefined}
          className="mt-1 h-9 w-full rounded-md border border-[var(--border)] px-3 text-sm"
          id={labelId}
          onBlur={(event) => {
            void labelRegistration.onBlur(event);
            commit(getValues());
          }}
        />
        <FieldError fieldId={labelId} message={fieldErrors.label} />
      </div>

      <div className="flex items-center gap-2">
        <input
          {...requiredRegistration}
          className="h-4 w-4 rounded border-[var(--border)]"
          id={requiredId}
          onBlur={(event) => {
            void requiredRegistration.onBlur(event);
            commit(getValues());
          }}
          type="checkbox"
        />
        <label className="text-sm" htmlFor={requiredId}>
          Input required
        </label>
      </div>

      <div>
        <label className="text-xs font-semibold" htmlFor={defaultValueId}>
          Input default value
        </label>
        <textarea
          {...defaultValueRegistration}
          aria-describedby={
            fieldErrors.defaultValue === undefined
              ? undefined
              : `${defaultValueId}-error`
          }
          aria-invalid={fieldErrors.defaultValue !== undefined}
          className="mt-1 min-h-24 w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
          id={defaultValueId}
          onBlur={(event) => {
            void defaultValueRegistration.onBlur(event);
            commit(getValues());
          }}
        />
        <FieldError
          fieldId={defaultValueId}
          message={fieldErrors.defaultValue}
        />
      </div>
    </SettingsSection>
  );
}

function TextTemplateSettings({ node }: { node: FlowNode }) {
  const updateNodeConfig = useEditorStore((store) => store.updateNodeConfig);
  const parsed = useMemo(
    () => textTemplateConfigSchema.safeParse(node.config),
    [node.config],
  );
  const initialConfig = parsed.success
    ? parsed.data
    : textTemplateNodeSpec.defaultConfig;
  const defaultValues = useMemo(
    () => ({ template: initialConfig.template }),
    [initialConfig.template],
  );
  const { getValues, register, reset } = useForm<TextTemplateFormValues>({
    defaultValues,
  });
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof TextTemplateFormValues, string>>
  >({});
  const templateId = useId();
  const helperId = useId();

  useEffect(() => {
    reset(defaultValues);
    setFieldErrors({});
  }, [defaultValues, reset]);

  const commit = (values: TextTemplateFormValues) => {
    const result = textTemplateConfigSchema.safeParse(values);

    if (!result.success) {
      setFieldErrors(collectFieldErrors(result.error.issues, ["template"]));
      return;
    }

    setFieldErrors({});
    updateNodeConfig(node.id, result.data);
  };

  const templateRegistration = register("template");

  return (
    <SettingsSection
      hasInvalidStoredConfig={!parsed.success}
      title="Text Template settings"
    >
      <div>
        <label className="text-xs font-semibold" htmlFor={templateId}>
          Template
        </label>
        <textarea
          {...templateRegistration}
          aria-describedby={[
            helperId,
            fieldErrors.template === undefined ? null : `${templateId}-error`,
          ]
            .filter((value): value is string => value !== null)
            .join(" ")}
          aria-invalid={fieldErrors.template !== undefined}
          className="mt-1 min-h-32 w-full rounded-md border border-[var(--border)] px-3 py-2 font-mono text-sm"
          id={templateId}
          onBlur={(event) => {
            void templateRegistration.onBlur(event);
            commit(getValues());
          }}
        />
        <p className="mt-1 text-xs text-[var(--muted)]" id={helperId}>
          Available placeholder: {"{{input}}"}
        </p>
        <FieldError fieldId={templateId} message={fieldErrors.template} />
      </div>
    </SettingsSection>
  );
}

function AiGenerateSettings({ node }: { node: FlowNode }) {
  const updateNodeConfig = useEditorStore((store) => store.updateNodeConfig);
  const parsed = useMemo(
    () => aiTextGenerateConfigSchema.safeParse(node.config),
    [node.config],
  );
  const initialConfig = parsed.success
    ? parsed.data
    : aiTextGenerateNodeSpec.defaultConfig;
  const defaultValues = useMemo(
    () => ({
      systemPrompt: initialConfig.systemPrompt ?? "",
    }),
    [initialConfig.systemPrompt],
  );
  const { getValues, register, reset } = useForm<AiGenerateFormValues>({
    defaultValues,
  });
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof AiGenerateFormValues, string>>
  >({});
  const systemPromptId = useId();

  useEffect(() => {
    reset(defaultValues);
    setFieldErrors({});
  }, [defaultValues, reset]);

  const commit = (values: AiGenerateFormValues) => {
    const result = aiTextGenerateConfigSchema.safeParse(
      toAiGenerateConfigCandidate(values),
    );

    if (!result.success) {
      setFieldErrors(collectFieldErrors(result.error.issues, ["systemPrompt"]));
      return;
    }

    setFieldErrors({});
    updateNodeConfig(node.id, result.data);
  };

  const systemPromptRegistration = register("systemPrompt");

  return (
    <SettingsSection
      hasInvalidStoredConfig={!parsed.success}
      title="AI Generate settings"
    >
      <dl className="rounded-md border border-[var(--border)] bg-[var(--background)] p-3 text-xs">
        <div>
          <dt className="font-semibold">Provider and model</dt>
          <dd className="mt-1 text-[var(--muted)]">
            Configured by the server environment.
          </dd>
        </div>
      </dl>
      <div>
        <label className="text-xs font-semibold" htmlFor={systemPromptId}>
          System prompt
        </label>
        <textarea
          {...systemPromptRegistration}
          aria-describedby={
            fieldErrors.systemPrompt === undefined
              ? undefined
              : `${systemPromptId}-error`
          }
          aria-invalid={fieldErrors.systemPrompt !== undefined}
          className="mt-1 min-h-32 w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
          id={systemPromptId}
          onBlur={(event) => {
            void systemPromptRegistration.onBlur(event);
            commit(getValues());
          }}
        />
        <FieldError
          fieldId={systemPromptId}
          message={fieldErrors.systemPrompt}
        />
      </div>
    </SettingsSection>
  );
}

function TextOutputSettings({ node }: { node: FlowNode }) {
  const updateNodeConfig = useEditorStore((store) => store.updateNodeConfig);
  const parsed = useMemo(
    () => textOutputConfigSchema.safeParse(node.config),
    [node.config],
  );
  const initialConfig = parsed.success
    ? parsed.data
    : textOutputNodeSpec.defaultConfig;
  const defaultValues = useMemo(
    () => ({
      key: initialConfig.key,
      label: initialConfig.label,
    }),
    [initialConfig.key, initialConfig.label],
  );
  const { getValues, register, reset } = useForm<TextOutputFormValues>({
    defaultValues,
  });
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof TextOutputFormValues, string>>
  >({});
  const keyId = useId();
  const labelId = useId();

  useEffect(() => {
    reset(defaultValues);
    setFieldErrors({});
  }, [defaultValues, reset]);

  const commit = (values: TextOutputFormValues) => {
    const result = textOutputConfigSchema.safeParse(values);

    if (!result.success) {
      setFieldErrors(collectFieldErrors(result.error.issues, ["key", "label"]));
      return;
    }

    setFieldErrors({});
    updateNodeConfig(node.id, result.data);
  };

  const keyRegistration = register("key");
  const labelRegistration = register("label");

  return (
    <SettingsSection
      hasInvalidStoredConfig={!parsed.success}
      title="Text Output settings"
    >
      <div>
        <label className="text-xs font-semibold" htmlFor={keyId}>
          Output key
        </label>
        <input
          {...keyRegistration}
          aria-describedby={
            fieldErrors.key === undefined ? undefined : `${keyId}-error`
          }
          aria-invalid={fieldErrors.key !== undefined}
          className="mt-1 h-9 w-full rounded-md border border-[var(--border)] px-3 text-sm"
          id={keyId}
          onBlur={(event) => {
            void keyRegistration.onBlur(event);
            commit(getValues());
          }}
        />
        <FieldError fieldId={keyId} message={fieldErrors.key} />
      </div>

      <div>
        <label className="text-xs font-semibold" htmlFor={labelId}>
          Output label
        </label>
        <input
          {...labelRegistration}
          aria-describedby={
            fieldErrors.label === undefined ? undefined : `${labelId}-error`
          }
          aria-invalid={fieldErrors.label !== undefined}
          className="mt-1 h-9 w-full rounded-md border border-[var(--border)] px-3 text-sm"
          id={labelId}
          onBlur={(event) => {
            void labelRegistration.onBlur(event);
            commit(getValues());
          }}
        />
        <FieldError fieldId={labelId} message={fieldErrors.label} />
      </div>
    </SettingsSection>
  );
}

function SettingsSection({
  children,
  hasInvalidStoredConfig,
  title,
}: {
  children: ReactNode;
  hasInvalidStoredConfig: boolean;
  title: string;
}) {
  return (
    <section className="space-y-4 rounded-md border border-[var(--border)] bg-white p-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      {hasInvalidStoredConfig ? (
        <p className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          Current config is invalid. Edit a field and leave it to replace the
          stored config.
        </p>
      ) : null}
      {children}
    </section>
  );
}

function FieldError({
  fieldId,
  message,
}: {
  fieldId: string;
  message: string | undefined;
}) {
  if (message === undefined) {
    return null;
  }

  return (
    <p className="mt-1 text-xs text-red-700" id={`${fieldId}-error`}>
      {message}
    </p>
  );
}

function toTextInputFormValues(config: TextInputConfig): TextInputFormValues {
  return {
    defaultValue: config.defaultValue ?? "",
    key: config.key,
    label: config.label,
    required: config.required,
  };
}

function toTextInputConfigCandidate(
  values: TextInputFormValues,
): TextInputConfig {
  if (values.defaultValue.length === 0) {
    return {
      key: values.key,
      label: values.label,
      required: values.required,
    };
  }

  return {
    defaultValue: values.defaultValue,
    key: values.key,
    label: values.label,
    required: values.required,
  };
}

function toAiGenerateConfigCandidate(
  values: AiGenerateFormValues,
): AiTextGenerateConfig {
  if (values.systemPrompt.length === 0) {
    return {};
  }

  return {
    systemPrompt: values.systemPrompt,
  };
}

function collectFieldErrors<TField extends string>(
  issues: readonly FieldIssue[],
  fields: readonly TField[],
): Partial<Record<TField, string>> {
  const fieldSet = new Set<string>(fields);
  const errors: Partial<Record<TField, string>> = {};

  for (const issue of issues) {
    const field = issue.path[0];

    if (typeof field !== "string" || !fieldSet.has(field)) {
      continue;
    }

    const typedField = field as TField;
    errors[typedField] ??= formatFieldError(field, issue.message);
  }

  return errors;
}

function formatFieldError(field: string, fallback: string): string {
  switch (field) {
    case "defaultValue":
      return `Default value must be ${MAX_TEXT_INPUT_DEFAULT_VALUE_LENGTH.toLocaleString()} characters or fewer.`;
    case "key":
      return "Key must start with a letter or underscore and contain only letters, numbers, and underscores.";
    case "label":
      return "Label must be 1 to 80 characters.";
    case "systemPrompt":
      return `System prompt must be ${MAX_SYSTEM_PROMPT_LENGTH.toLocaleString()} characters or fewer.`;
    case "template":
      return `Template must be 1 to ${MAX_TEMPLATE_LENGTH.toLocaleString()} characters.`;
    default:
      return fallback;
  }
}
