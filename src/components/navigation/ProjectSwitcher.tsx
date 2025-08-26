import { useState, useRef, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useProjectStore, useActiveProject, useProjects } from "@/stores/projectStore";
import {
  Building2,
  ChevronDown,
  Plus,
  MapPin,
  Star,
  TrendingUp,
  Calendar,
  DollarSign,
  Check,
  Building,
} from "lucide-react";

interface ProjectSwitcherProps {
  className?: string;
  variant?: "full" | "compact";
}

export function ProjectSwitcher({ className, variant = "full" }: ProjectSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();
  const activeProject = useActiveProject();
  const projects = useProjects();
  const switchProject = useProjectStore((state) => state.switchProject);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !buttonRef.current?.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  // Close on escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    }

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen]);

  const handleProjectSwitch = (projectId: string) => {
    switchProject(projectId);
    setIsOpen(false);
  };

  const handleAddNewProject = () => {
    setIsOpen(false);
    navigate({ to: "/settings/project" });
  };

  if (variant === "compact") {
    return (
      <div className={`relative ${className}`}>
        <button
          ref={buttonRef}
          onClick={() => setIsOpen(!isOpen)}
          className="hover:bg-sand-100 group flex min-h-[44px] items-center gap-2 rounded-xl px-3 py-2 text-left transition-colors dark:hover:bg-gray-700"
          aria-expanded={isOpen}
          aria-haspopup="true"
          aria-label="Switch project"
        >
          <Building2 className="text-ocean-600 dark:text-ocean-400 h-5 w-5" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
              {activeProject?.name || "Select Resort"}
            </p>
          </div>
          <ChevronDown
            className={`h-4 w-4 text-gray-400 transition-all duration-200 ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {isOpen && (
          <div
            ref={dropdownRef}
            className="border-sand-200 absolute top-full right-0 left-0 z-50 mt-1 min-w-[280px] overflow-hidden rounded-xl border bg-white/95 shadow-xl backdrop-blur-xl dark:border-gray-700 dark:bg-gray-800/95"
            role="menu"
          >
            <ProjectDropdownContent
              projects={projects}
              activeProject={activeProject}
              onProjectSelect={handleProjectSwitch}
              onAddNew={handleAddNewProject}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="group flex min-h-[60px] w-full items-center justify-between rounded-xl bg-white/20 px-4 py-3 text-left backdrop-blur-sm transition-colors hover:bg-white/30"
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label="Switch project"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
            <Building2 className="h-6 w-6 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">
              {activeProject?.name || "Select Resort"}
            </p>
            <p className="text-ocean-100 mt-1 flex items-center gap-2 text-xs">
              {activeProject?.stats ? (
                <>
                  <span className="flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />₱
                    {activeProject.stats.totalRevenue.toLocaleString("en-PH")}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {activeProject.stats.totalBookings} bookings
                  </span>
                </>
              ) : (
                <span>No active resort selected</span>
              )}
            </p>
          </div>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-white transition-all duration-200 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute top-full right-0 left-0 z-50 mt-2 overflow-hidden rounded-xl border border-white/20 bg-white/95 shadow-2xl backdrop-blur-xl dark:border-gray-700 dark:bg-gray-800/95"
          role="menu"
        >
          <ProjectDropdownContent
            projects={projects}
            activeProject={activeProject}
            onProjectSelect={handleProjectSwitch}
            onAddNew={handleAddNewProject}
          />
        </div>
      )}
    </div>
  );
}

interface ProjectDropdownContentProps {
  projects: any[];
  activeProject: any;
  onProjectSelect: (projectId: string) => void;
  onAddNew: () => void;
}

function ProjectDropdownContent({
  projects,
  activeProject,
  onProjectSelect,
  onAddNew,
}: ProjectDropdownContentProps) {
  return (
    <>
      {/* Header */}
      <div className="border-sand-200 from-sand-50/50 to-coral-50/50 border-b bg-gradient-to-r px-4 py-3 dark:border-gray-700 dark:from-gray-800/50 dark:to-gray-700/50">
        <p className="text-sm font-semibold text-gray-900 dark:text-white">Switch Resort</p>
        <p className="text-xs text-gray-600 dark:text-gray-400">
          Choose your active resort property
        </p>
      </div>

      {/* Project List */}
      <div className="max-h-80 overflow-y-auto py-2">
        {projects.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <Building className="mx-auto mb-3 h-8 w-8 text-gray-400" />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              No resorts available
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
              Create your first resort to get started
            </p>
          </div>
        ) : (
          projects.map((project) => {
            const isActive = activeProject?.id === project.id;
            return (
              <button
                key={project.id}
                onClick={() => onProjectSelect(project.id)}
                className={`hover:bg-ocean-50 mx-2 flex min-h-[56px] w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition-colors dark:hover:bg-gray-700 ${isActive ? "bg-ocean-100 dark:bg-ocean-900/20" : ""} `}
                role="menuitem"
                aria-current={isActive ? "true" : undefined}
              >
                {/* Project Icon & Status */}
                <div className="relative">
                  <div className="from-ocean-500 to-coral-500 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm">
                    <Building2 className="h-5 w-5" />
                  </div>
                  {project.featured && (
                    <div className="bg-sunset-400 absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full">
                      <Star className="h-2.5 w-2.5 text-white" />
                    </div>
                  )}
                </div>

                {/* Project Details */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                      {project.name}
                    </p>
                    {isActive && (
                      <Check className="text-ocean-600 dark:text-ocean-400 h-4 w-4 flex-shrink-0" />
                    )}
                  </div>
                  <p className="truncate text-xs text-gray-600 dark:text-gray-400">
                    {project.type} • {project.location}
                  </p>

                  {/* Stats */}
                  {project.stats && (
                    <div className="mt-1 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-500">
                      <span className="flex items-center gap-1">
                        <TrendingUp className="text-palm-500 h-3 w-3" />₱
                        {project.stats.monthlyRevenue?.toLocaleString("en-PH") || "0"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="text-coral-500 h-3 w-3" />
                        {project.stats.activeBookings || 0}
                      </span>
                    </div>
                  )}
                </div>

                {/* Location */}
                <div className="flex-shrink-0 text-right">
                  <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-500">
                    <MapPin className="h-3 w-3" />
                    <span className="hidden sm:inline">PH</span>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Add New Project */}
      <div className="border-sand-200 border-t dark:border-gray-700">
        <button
          onClick={onAddNew}
          className="hover:bg-sand-50 group flex min-h-[56px] w-full items-center gap-3 px-4 py-3 text-left transition-colors dark:hover:bg-gray-700"
          role="menuitem"
        >
          <div className="from-palm-500 to-ocean-500 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm transition-transform group-hover:scale-105">
            <Plus className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900 dark:text-white">Add New Resort</p>
            <p className="text-xs text-gray-600 dark:text-gray-400">Create a new resort property</p>
          </div>
        </button>
      </div>
    </>
  );
}
