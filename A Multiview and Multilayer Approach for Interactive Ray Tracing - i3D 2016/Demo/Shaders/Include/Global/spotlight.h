#line 2
// Spotlight specific utilities

// Checks whether a particular incident (light) direction is inside or outside a spotlight
// Parameters:
// view: matrix to convert light direction to ECS (same space as the other calculations)
// vertex_to_light_direction_ecs: the incident direction (light or next vertex) 
// Returns the amount of light being cut off by the spotlight
float check_spotlight(mat4 view, vec3 vertex_to_light_direction_ecs)
{
	float spoteffect = 1;
	if (uniform_light_is_conical == 1)
	{
		vec3 light_direction_ecs = normalize((view * vec4(uniform_light_direction, 0)).xyz);
		float angle_vertex_spot_dir = dot(normalize(-vertex_to_light_direction_ecs), light_direction_ecs);

		// if angle is less than the penumbra (cosine is reverse)
		// if angle is between the penumbra region
		// if angle is outside the umbra region
		if (angle_vertex_spot_dir >= uniform_light_cosine_penumbra)
			spoteffect = 1;
		else if (uniform_light_cosine_penumbra > angle_vertex_spot_dir && uniform_light_cosine_umbra < angle_vertex_spot_dir)
		{
			float attenuate = (angle_vertex_spot_dir - uniform_light_cosine_umbra) / (uniform_light_cosine_penumbra - uniform_light_cosine_umbra);
			spoteffect = pow(attenuate, uniform_spotlight_exponent);
		}
		else spoteffect = 0;
	}
	return spoteffect;
}