import {
  closestCenter,
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  restrictToParentElement as restrictToParentElementModifier,
  restrictToVerticalAxis as restrictToVerticalAxisModifier,
} from '@dnd-kit/modifiers';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, ChevronUp, ChevronDown, ArrowUpDown } from 'lucide-react';
import { useState, useRef, useEffect } from "react";
import { SortKey } from "../lib/sorting";
import { cn } from "../lib/utils";

function SortableItem({ sortKey, index, onToggleDirection }: {
  sortKey: SortKey;
  index: number;
  onToggleDirection: (name: string, ascending: boolean) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: sortKey.name });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
  className="flex items-center gap-2 px-3 py-2 bg-light border border-border rounded text-sm whitespace-nowrap select-none touch-manipulation"
    >
      <div
        {...attributes}
        {...listeners}
  className="cursor-grab active:cursor-grabbing text-gray hover:text-gray-600 select-none touch-manipulation"
      >
        <GripVertical size={18} />
      </div>
      <span className="text-gray w-2 mr-0.5">{index + 1}.</span>
      <span className="flex-1 min-w-0">{sortKey.name}</span>
      <div className="flex gap-1 flex-shrink-0">
        <button
          className={cn(
            "px-1.5 py-1 text-xs rounded transition-colors",
            sortKey.ascending
              ? 'bg-primary text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          )}
          onClick={() => onToggleDirection(sortKey.name, true)}
        >
          <ChevronUp size={12} />
        </button>
        <button
          className={cn(
            "px-1.5 py-1 text-xs rounded transition-colors",
            !sortKey.ascending
              ? 'bg-primary text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          )}
          onClick={() => onToggleDirection(sortKey.name, false)}
        >
          <ChevronDown size={12} />
        </button>
      </div>
    </div>
  );
}

export function SortDropdown({ sortKeys, setSortKeys }: {
  sortKeys: SortKey[];
  setSortKeys: (sortKeys: SortKey[]) => void;
}) {
  const [displayPopup, setDisplayPopup] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDisplayPopup(false);
      }
    }

    if (displayPopup) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [displayPopup]);

  const sensors = useSensors(
    useSensor(MouseSensor),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (active.id !== over?.id) {
      setSortKeys(arrayMove(sortKeys,
        sortKeys.findIndex((item) => item.name === active.id),
        sortKeys.findIndex((item) => item.name === over?.id)
      ));
    }
  }

  function handleToggleDirection(name: string, ascending: boolean) {
    setSortKeys(
      sortKeys.map(item =>
        item.name === name ? { ...item, ascending } : item
      )
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        className="rounded px-3 py-1 bg-primary transition text-center text-base hover:brightness-110 shadow-sm flex items-center gap-2"
        onClick={() => setDisplayPopup(!displayPopup)}
      >
        <ArrowUpDown size={13}></ArrowUpDown>
        Sort
      </button>
      {displayPopup && (
        <div className="absolute bg-light border border-border shadow-lg p-1 rounded top-9 left-0 flex flex-col gap-1 min-w-64 z-10">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            modifiers={[restrictToVerticalAxisModifier, restrictToParentElementModifier]}
          >
            <SortableContext
              items={sortKeys.map(key => key.name)}
              strategy={verticalListSortingStrategy}
            >
              {sortKeys.map((sortKey, index) => (
                <SortableItem
                  key={sortKey.name}
                  sortKey={sortKey}
                  index={index}
                  onToggleDirection={handleToggleDirection}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      )}
    </div>
  );
}
