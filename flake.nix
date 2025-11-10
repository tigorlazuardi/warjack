{
  description = "Description for the project";

  inputs = {
    flake-parts.url = "github:hercules-ci/flake-parts";
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs =
    inputs@{ flake-parts, ... }:
    flake-parts.lib.mkFlake { inherit inputs; } {
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "aarch64-darwin"
        "x86_64-darwin"
      ];
      perSystem =
        {
          pkgs,
          ...
        }:
        {
          devShells.default = pkgs.mkShell {
            packages = with pkgs; [
              git
              bun
            ];
            shellHook = ''
              export PROJECT_DIR=$(git rev-parse --show-toplevel)
              export DATABASE_DIR="''${PROJECT_DIR}/artifacts/database"
              export DATABASE_URL="''${DATABASE_DIR}/dev.db"

              mkdir -p "''${DATABASE_DIR}"
            '';
          };
          packages.default = pkgs.hello;
        };
    };
}
