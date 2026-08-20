import bpy
import os
import math

def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    if not bpy.data.scenes:
        bpy.data.scenes.new("Scene")

def create_smooth_issue_orb(export_path):
    reset_scene()
    
    # 1. High-Definition Ultra-Smooth Core Sphere (48x48 segments with smooth shading)
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=48,
        ring_count=32,
        radius=0.8,
        location=(0, 0, 0)
    )
    core = bpy.context.active_object
    core.name = "SmoothCore"
    bpy.ops.object.shade_smooth()
    
    # 2. Sleek Gimbal Tech Rings (Smooth Torus)
    bpy.ops.mesh.primitive_torus_add(
        major_radius=1.15,
        minor_radius=0.045,
        major_segments=48,
        minor_segments=16,
        location=(0, 0, 0),
        rotation=(math.radians(65), math.radians(25), 0)
    )
    ring1 = bpy.context.active_object
    ring1.name = "SmoothRing1"
    bpy.ops.object.shade_smooth()
    
    bpy.ops.mesh.primitive_torus_add(
        major_radius=1.28,
        minor_radius=0.035,
        major_segments=48,
        minor_segments=16,
        location=(0, 0, 0),
        rotation=(math.radians(-50), math.radians(70), math.radians(30))
    )
    ring2 = bpy.context.active_object
    ring2.name = "SmoothRing2"
    bpy.ops.object.shade_smooth()
    
    # 3. Outer Energy Shield Shell (slightly larger transparent glow shell)
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=32,
        ring_count=24,
        radius=0.92,
        location=(0, 0, 0)
    )
    glow_shell = bpy.context.active_object
    glow_shell.name = "GlowShell"
    bpy.ops.object.shade_smooth()

    # Join objects
    for obj in [core, ring1, ring2, glow_shell]:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = core
    bpy.ops.object.join()
    final_orb = bpy.context.active_object
    final_orb.name = "SmoothIssueOrb"
    
    # 4. Material with rich emission
    mat = bpy.data.materials.new(name="SmoothOrbMat")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        if "Base Color" in bsdf.inputs:
            bsdf.inputs["Base Color"].default_value = (0.1, 0.6, 1.0, 1.0)
        if "Metallic" in bsdf.inputs:
            bsdf.inputs["Metallic"].default_value = 0.8
        if "Roughness" in bsdf.inputs:
            bsdf.inputs["Roughness"].default_value = 0.1
        if "Emission Color" in bsdf.inputs:
            bsdf.inputs["Emission Color"].default_value = (0.3, 0.8, 1.0, 1.0)
        elif "Emission" in bsdf.inputs:
            bsdf.inputs["Emission"].default_value = (0.3, 0.8, 1.0, 1.0)
        if "Emission Strength" in bsdf.inputs:
            bsdf.inputs["Emission Strength"].default_value = 3.0
            
    final_orb.data.materials.append(mat)
    
    # 5. Export
    os.makedirs(os.path.dirname(export_path), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=export_path,
        export_format='GLB',
        export_materials='EXPORT',
        export_apply=True
    )
    print("SUCCESS: Exported smooth_issue_orb.glb to:", export_path)

if __name__ == "__main__":
    out_path = "/Users/shridhartawate/Documents/Codeisance/frontend/public/models/smooth_issue_orb.glb"
    create_smooth_issue_orb(out_path)
