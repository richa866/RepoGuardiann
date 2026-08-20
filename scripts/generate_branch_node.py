import bpy
import os
import math

def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    if not bpy.data.scenes:
        bpy.data.scenes.new("Scene")

def create_git_branch_node(export_path):
    reset_scene()
    
    # 1. Primary Faceted Hexagonal Crystal / Diamond Commit Core
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=6,
        radius=0.7,
        depth=0.5,
        location=(0, 0, 0),
        rotation=(math.radians(90), 0, 0)
    )
    core = bpy.context.active_object
    core.name = "CommitCrystal"
    
    # 2. Outer Dual Tech Brackets (Git clamp arms)
    bpy.ops.mesh.primitive_torus_add(
        major_radius=0.95,
        minor_radius=0.07,
        major_segments=6,
        minor_segments=8,
        location=(0, 0, 0),
        rotation=(0, math.radians(90), 0)
    )
    bracket = bpy.context.active_object
    bracket.name = "TechBracket"
    
    # 3. Branch Pin Ports (horizontal connection indicators)
    bpy.ops.mesh.primitive_cylinder_add(
        radius=0.15,
        depth=1.6,
        vertices=8,
        location=(0, 0, 0),
        rotation=(0, 0, math.radians(90))
    )
    pins = bpy.context.active_object
    pins.name = "BranchPins"
    
    # Join into single object
    for obj in [core, bracket, pins]:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = core
    bpy.ops.object.join()
    final_node = bpy.context.active_object
    final_node.name = "GitBranchCommitNode"
    
    # 4. Material with emission
    mat = bpy.data.materials.new(name="BranchNodeMat")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        if "Base Color" in bsdf.inputs:
            bsdf.inputs["Base Color"].default_value = (0.1, 0.5, 0.9, 1.0)
        if "Metallic" in bsdf.inputs:
            bsdf.inputs["Metallic"].default_value = 0.9
        if "Roughness" in bsdf.inputs:
            bsdf.inputs["Roughness"].default_value = 0.15
        if "Emission Color" in bsdf.inputs:
            bsdf.inputs["Emission Color"].default_value = (0.2, 0.7, 1.0, 1.0)
        elif "Emission" in bsdf.inputs:
            bsdf.inputs["Emission"].default_value = (0.2, 0.7, 1.0, 1.0)
        if "Emission Strength" in bsdf.inputs:
            bsdf.inputs["Emission Strength"].default_value = 2.5
            
    final_node.data.materials.append(mat)
    
    # 5. Export to GLB
    os.makedirs(os.path.dirname(export_path), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=export_path,
        export_format='GLB',
        export_materials='EXPORT',
        export_apply=True
    )
    print("SUCCESS: Exported git_branch_node.glb to:", export_path)

if __name__ == "__main__":
    out_path = "/Users/shridhartawate/Documents/Codeisance/frontend/public/models/git_branch_node.glb"
    create_git_branch_node(out_path)
