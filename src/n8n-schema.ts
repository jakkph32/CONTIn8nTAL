import * as z from 'zod';

// Define a basic schema for an n8n node.  This is very simplified!
const n8nNodeSchema = z.object({
  name: z.string(),
  type: z.string(),
  parameters: z.record(z.any()).optional(), // Allow any parameters for now
});

// Define a basic schema for an n8n connection
const n8nConnectionSchema = z.object({
  source: z.string(),
  destination: z.string(),
});

// Define a basic schema for an n8n workflow
export const n8nWorkflowSchema = z.object({
  name: z.string(),
  nodes: z.array(n8nNodeSchema),
  connections: z.array(n8nConnectionSchema).optional(),
  active: z.boolean().optional(),
  settings: z.record(z.any()).optional(),
  version: z.number().optional()
});

export type N8nWorkflow = z.infer<typeof n8nWorkflowSchema>;