#line 2 
// convert a vector from WCS to ECS for arrays of matrices
// Parameters:
// - v_wcs, the input vector in WCS
// - index, the index in the matrices array
// returns a vec3 in ECS
vec3 VectorWCS2ECSArray(in vec3 v_wcs, in int index)
{
	vec4 v_ecs = uniform_view[index] * vec4(v_wcs, 0);
	return v_ecs.xyz;
}

// convert a point from WCS to ECS for arrays of matrices
// Parameters:
// - p_wcs, the input point in WCS
// - index, the index in the matrices array
// returns a vec3 in ECS
vec3 PointWCS2ECSArray(in vec3 p_ecs, in int index)
{
	vec4 p_wcs = uniform_view[index] * vec4(p_ecs, 1);
	return p_wcs.xyz;
}

// convert a vector from ECS to WCS for arrays of matrices
// Parameters:
// - v_ecs, the input vector in ECS
// - index, the index in the matrices array
// returns a vec3 in WCS
vec3 VectorECS2WCSArray(in vec3 v_ecs, in int index)
{
	vec4 v_wcs = uniform_view_inverse[index] * vec4(v_ecs, 0);
	return v_wcs.xyz;
}

// convert a point from ECS to WCS for arrays of matrices
// Parameters:
// - p_ecs, the input point in ECS
// - index, the index in the matrices array
// returns a vec3 in WCS
vec3 PointECS2WCSArray(in vec3 p_ecs, in int index)
{
	vec4 p_wcs = uniform_view_inverse[index] * vec4(p_ecs, 1);
	return p_wcs.xyz;
}