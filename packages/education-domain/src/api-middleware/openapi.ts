import { OpenApiGeneratorV3, OpenAPIRegistry } from '../shims/external-adapters';
import type { OpenAPIObjectConfig } from '../shims/external-adapters';

/**
 * Creates a new OpenAPI registry for defining routes and schemas.
 */
export function createRegistry(): OpenAPIRegistry {
  return new OpenAPIRegistry();
}

/**
 * Generates the final OpenAPI 3.0 specification object from the given registry.
 * 
 * @param registry The populated OpenAPIRegistry
 * @param config The base OpenAPI document configuration (title, version, servers)
 */
export function generateOpenApiSpec(
  registry: OpenAPIRegistry,
  config: OpenAPIObjectConfig
) {
  registry.registerComponent('securitySchemes', 'bearerAuth', {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
  });
  registry.registerComponent('securitySchemes', 'cookieAuth', {
    type: 'apiKey',
    in: 'cookie',
    name: 'csrf_token',
  });

  const generator = new OpenApiGeneratorV3(registry.definitions);
  
  return generator.generateDocument(config);
}

/**
 * Helper route handler for exposing the OpenAPI spec as JSON.
 * Example usage in a worker:
 *   if (path === '/docs/openapi.json') return handleDocs(registry, { info: { title: 'Auth API', version: '1.0' }});
 */
export function handleOpenApiDocs(registry: OpenAPIRegistry, config: OpenAPIObjectConfig): Response {
  const spec = generateOpenApiSpec(registry, config);
  return new Response(JSON.stringify(spec), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
