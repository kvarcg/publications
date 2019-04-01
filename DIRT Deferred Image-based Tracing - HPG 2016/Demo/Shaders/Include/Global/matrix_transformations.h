#line 2
// convert a vector from WCS to ECS
// Parameters:
// - v_wcs, the input vector in WCS
// returns a vec3 in ECS
vec3 VectorWCS2ECS(in vec3 v_wcs)
{
	vec4 v_ecs = uniform_view * vec4(v_wcs, 0);
	return v_ecs.xyz;
}

// convert a point from WCS to ECS
// Parameters:
// - p_wcs, the input point in WCS
// returns a vec3 in ECS
vec3 PointWCS2ECS(in vec3 p_ecs)
{
	vec4 p_wcs = uniform_view * vec4(p_ecs, 1);
	return p_wcs.xyz;
}

// convert a vector from ECS to WCS
// Parameters:
// - v_ecs, the input vector in ECS
// returns a vec3 in WCS
vec3 VectorECS2WCS(in vec3 v_ecs)
{
	vec4 v_wcs = uniform_view_inverse * vec4(v_ecs, 0);
	return v_wcs.xyz;
}

// convert a point from ECS to WCS
// Parameters:
// - p_ecs, the input point in ECS
// returns a vec3 in WCS
vec3 PointECS2WCS(in vec3 p_ecs)
{
	vec4 p_wcs = uniform_view_inverse * vec4(p_ecs, 1);
	return p_wcs.xyz;
}