"use client";

import {
  AdminButton,
  AdminDrawer,
  AdminEmptyState,
  AdminField,
  AdminInput,
  AdminPanel,
  AdminSelect,
  AdminTextarea,
} from "@/components/admin/AdminWorkspace";
import {
  CategoryRow,
  formatStorefrontLabel,
  getStorefrontBadgeTone,
} from "./catalogShared";
import {
  STOREFRONT_ASSIGNMENT_OPTIONS,
  getStorefrontAssignmentValue,
  type StorefrontCode,
} from "@/lib/storefronts";

type CategoryDrawerProps = {
  open: boolean;
  categories: CategoryRow[];
  parents: CategoryRow[];
  childrenByParent: Map<string, CategoryRow[]>;
  selectedCategoryId: string | null;
  selectedCategory: CategoryRow | null;
  selectedCategoryChildren: CategoryRow[];
  newCategory: {
    name: string;
    handle: string;
    description: string;
    parentId: string;
    storefronts: string;
  };
  onClose: () => void;
  onSelectCategory: (id: string) => void;
  onNewCategoryChange: (
    value: Partial<{
      name: string;
      handle: string;
      description: string;
      parentId: string;
      storefronts: string;
    }>,
  ) => void;
  onCreateCategory: () => void;
  onUpdateCategory: (id: string, value: Partial<CategoryRow>) => void;
  onSaveCategory: () => void;
  onPrepareDeleteCategory: () => void;
};

export function CategoryManagementDrawer({
  open,
  categories,
  parents,
  childrenByParent,
  selectedCategoryId,
  selectedCategory,
  selectedCategoryChildren,
  newCategory,
  onClose,
  onSelectCategory,
  onNewCategoryChange,
  onCreateCategory,
  onUpdateCategory,
  onSaveCategory,
  onPrepareDeleteCategory,
}: CategoryDrawerProps) {
  return (
    <AdminDrawer
      open={open}
      title="Category management"
      description="Maintain the product taxonomy without pushing the product table off screen."
      onClose={onClose}
      widthClassName="w-full max-w-6xl"
    >
      <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-5">
          <AdminPanel
            eyebrow="Create"
            title="Add category"
            description="Create a new top-level or nested category."
            className="p-4"
          >
            <div className="space-y-4">
              <AdminField label="Name">
                <AdminInput
                  value={newCategory.name}
                  onChange={(event) => onNewCategoryChange({ name: event.target.value })}
                  placeholder="Category name"
                />
              </AdminField>
              <AdminField label="Handle">
                <AdminInput
                  value={newCategory.handle}
                  onChange={(event) => onNewCategoryChange({ handle: event.target.value })}
                  placeholder="category-handle"
                />
              </AdminField>
              <AdminField label="Parent">
                <AdminSelect
                  value={newCategory.parentId}
                  onChange={(event) => onNewCategoryChange({ parentId: event.target.value })}
                >
                  <option value="">No parent</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </AdminSelect>
              </AdminField>
              <AdminField label="Description">
                <AdminTextarea
                  rows={4}
                  value={newCategory.description}
                  onChange={(event) =>
                    onNewCategoryChange({ description: event.target.value })
                  }
                  placeholder="How this category should be used"
                />
              </AdminField>
              <AdminField label="Storefront visibility">
                <AdminSelect
                  value={newCategory.storefronts}
                  onChange={(event) =>
                    onNewCategoryChange({ storefronts: event.target.value })
                  }
                >
                  {STOREFRONT_ASSIGNMENT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </AdminSelect>
              </AdminField>
              <AdminButton type="button" className="w-full" onClick={onCreateCategory}>
                Create category
              </AdminButton>
            </div>
          </AdminPanel>

          <AdminPanel
            eyebrow="Hierarchy"
            title="Browse categories"
            description="Top-level entries and their child nodes."
            className="p-4"
          >
            <div className="space-y-2">
              {parents.length === 0 ? (
                <AdminEmptyState
                  title="No categories yet"
                  description="Create the first category to start assigning products."
                />
              ) : (
                parents.map((parent) => (
                  <div key={parent.id} className="space-y-2">
                    <EntityButton
                      label={parent.name}
                      subtitle={`/${parent.handle}`}
                      badge="Top"
                      storefronts={parent.storefronts}
                      selected={selectedCategoryId === parent.id}
                      onClick={() => onSelectCategory(parent.id)}
                    />
                    {(childrenByParent.get(parent.id) ?? []).map((child) => (
                      <div key={child.id} className="ml-4">
                        <EntityButton
                          label={child.name}
                          subtitle={`/${child.handle}`}
                          badge="Child"
                          storefronts={child.storefronts}
                          selected={selectedCategoryId === child.id}
                          onClick={() => onSelectCategory(child.id)}
                        />
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
          </AdminPanel>
        </div>

        {selectedCategory ? (
          <div className="space-y-5">
            <AdminPanel
              eyebrow="Editor"
              title={selectedCategory.name}
              description="Edit the selected category and preserve its hierarchy."
              actions={
                <div className="flex items-center gap-2">
                  <AdminButton type="button" tone="secondary" onClick={onSaveCategory}>
                    Save category
                  </AdminButton>
                  <AdminButton type="button" tone="danger" onClick={onPrepareDeleteCategory}>
                    Delete
                  </AdminButton>
                </div>
              }
            >
              <div className="grid gap-4 md:grid-cols-2">
                <AdminField label="Name">
                  <AdminInput
                    value={selectedCategory.name}
                    onChange={(event) =>
                      onUpdateCategory(selectedCategory.id, {
                        name: event.target.value,
                      })
                    }
                  />
                </AdminField>
                <AdminField label="Handle">
                  <AdminInput
                    value={selectedCategory.handle}
                    onChange={(event) =>
                      onUpdateCategory(selectedCategory.id, {
                        handle: event.target.value,
                      })
                    }
                  />
                </AdminField>
                <AdminField label="Parent">
                  <AdminSelect
                    value={selectedCategory.parentId ?? ""}
                    onChange={(event) =>
                      onUpdateCategory(selectedCategory.id, {
                        parentId: event.target.value || null,
                      })
                    }
                  >
                    <option value="">No parent</option>
                    {categories
                      .filter((category) => category.id !== selectedCategory.id)
                      .map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                  </AdminSelect>
                </AdminField>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                    Node Type
                  </div>
                  <div className="mt-2 text-sm text-slate-200">
                    {selectedCategory.parentId ? "Child category" : "Top-level category"}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(selectedCategory.storefronts ?? []).map((storefront) => (
                      <span
                        key={`${selectedCategory.id}-${storefront}`}
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getStorefrontBadgeTone(
                          storefront,
                        )}`}
                      >
                        {formatStorefrontLabel(storefront)}
                      </span>
                    ))}
                  </div>
                </div>
                <AdminField label="Storefront visibility">
                  <AdminSelect
                    value={getStorefrontAssignmentValue(selectedCategory.storefronts ?? ["MAIN"])}
                    onChange={(event) =>
                      onUpdateCategory(selectedCategory.id, {
                        storefronts: event.target.value
                          .split(",")
                          .map((value) => value.trim())
                          .filter(Boolean) as StorefrontCode[],
                      })
                    }
                  >
                    {STOREFRONT_ASSIGNMENT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </AdminSelect>
                </AdminField>
                <div className="md:col-span-2">
                  <AdminField label="Description">
                    <AdminTextarea
                      rows={5}
                      value={selectedCategory.description ?? ""}
                      onChange={(event) =>
                        onUpdateCategory(selectedCategory.id, {
                          description: event.target.value,
                        })
                      }
                    />
                  </AdminField>
                </div>
              </div>
            </AdminPanel>

            <AdminPanel
              eyebrow="Relationships"
              title="Hierarchy context"
              description="Quick context for where the selected category sits."
            >
              <div className="grid gap-4 md:grid-cols-2">
                <InfoCard
                  label="Parent"
                  value={
                    selectedCategory.parentId
                      ? categories.find(
                          (category) => category.id === selectedCategory.parentId,
                        )?.name ?? "Unknown parent"
                      : "No parent assigned"
                  }
                />
                <InfoCard
                  label="Direct children"
                  value={String(selectedCategoryChildren.length)}
                />
              </div>
              {selectedCategoryChildren.length ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {selectedCategoryChildren.map((child) => (
                    <button
                      key={child.id}
                      type="button"
                      onClick={() => onSelectCategory(child.id)}
                      className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-slate-300 transition hover:border-white/20 hover:bg-white/[0.06]"
                    >
                      {child.name}
                    </button>
                  ))}
                </div>
              ) : null}
            </AdminPanel>
          </div>
        ) : (
          <AdminEmptyState
            title="Select a category"
            description="Choose a node from the hierarchy to edit it."
          />
        )}
      </div>
    </AdminDrawer>
  );
}

type CollectionDrawerProps = {
  open: boolean;
  collections: CategoryRow[];
  selectedCollectionId: string | null;
  selectedCollection: CategoryRow | null;
  newCollection: {
    name: string;
    handle: string;
    description: string;
  };
  onClose: () => void;
  onSelectCollection: (id: string) => void;
  onNewCollectionChange: (
    value: Partial<{
      name: string;
      handle: string;
      description: string;
    }>,
  ) => void;
  onCreateCollection: () => void;
  onUpdateCollection: (id: string, value: Partial<CategoryRow>) => void;
  onSaveCollection: () => void;
  onPrepareDeleteCollection: () => void;
};

export function CollectionManagementDrawer({
  open,
  collections,
  selectedCollectionId,
  selectedCollection,
  newCollection,
  onClose,
  onSelectCollection,
  onNewCollectionChange,
  onCreateCollection,
  onUpdateCollection,
  onSaveCollection,
  onPrepareDeleteCollection,
}: CollectionDrawerProps) {
  return (
    <AdminDrawer
      open={open}
      title="Collection management"
      description="Curate collections in a separate panel without reintroducing the legacy stacked form layout."
      onClose={onClose}
      widthClassName="w-full max-w-5xl"
    >
      <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-5">
          <AdminPanel
            eyebrow="Create"
            title="Add collection"
            description="Create a new merch grouping."
            className="p-4"
          >
            <div className="space-y-4">
              <AdminField label="Name">
                <AdminInput
                  value={newCollection.name}
                  onChange={(event) => onNewCollectionChange({ name: event.target.value })}
                  placeholder="Collection name"
                />
              </AdminField>
              <AdminField label="Handle">
                <AdminInput
                  value={newCollection.handle}
                  onChange={(event) => onNewCollectionChange({ handle: event.target.value })}
                  placeholder="collection-handle"
                />
              </AdminField>
              <AdminField label="Description">
                <AdminTextarea
                  rows={4}
                  value={newCollection.description}
                  onChange={(event) =>
                    onNewCollectionChange({ description: event.target.value })
                  }
                  placeholder="How this collection is used"
                />
              </AdminField>
              <AdminButton type="button" className="w-full" onClick={onCreateCollection}>
                Create collection
              </AdminButton>
            </div>
          </AdminPanel>

          <AdminPanel
            eyebrow="Browser"
            title="Collection list"
            description="Select a collection to edit its metadata."
            className="p-4"
          >
            <div className="space-y-2">
              {collections.length === 0 ? (
                <AdminEmptyState
                  title="No collections yet"
                  description="Create a collection to group products for campaigns or featured shelves."
                />
              ) : (
                collections.map((collection) => (
                  <EntityButton
                    key={collection.id}
                    label={collection.name}
                    subtitle={`/${collection.handle}`}
                    badge="Live"
                    selected={selectedCollectionId === collection.id}
                    onClick={() => onSelectCollection(collection.id)}
                  />
                ))
              )}
            </div>
          </AdminPanel>
        </div>

        {selectedCollection ? (
          <div className="space-y-5">
            <AdminPanel
              eyebrow="Editor"
              title={selectedCollection.name}
              description="Edit the selected collection and keep the list focused."
              actions={
                <div className="flex items-center gap-2">
                  <AdminButton type="button" tone="secondary" onClick={onSaveCollection}>
                    Save collection
                  </AdminButton>
                  <AdminButton type="button" tone="danger" onClick={onPrepareDeleteCollection}>
                    Delete
                  </AdminButton>
                </div>
              }
            >
              <div className="grid gap-4 md:grid-cols-2">
                <AdminField label="Name">
                  <AdminInput
                    value={selectedCollection.name}
                    onChange={(event) =>
                      onUpdateCollection(selectedCollection.id, {
                        name: event.target.value,
                      })
                    }
                  />
                </AdminField>
                <AdminField label="Handle">
                  <AdminInput
                    value={selectedCollection.handle}
                    onChange={(event) =>
                      onUpdateCollection(selectedCollection.id, {
                        handle: event.target.value,
                      })
                    }
                  />
                </AdminField>
                <div className="md:col-span-2">
                  <AdminField label="Description">
                    <AdminTextarea
                      rows={5}
                      value={selectedCollection.description ?? ""}
                      onChange={(event) =>
                        onUpdateCollection(selectedCollection.id, {
                          description: event.target.value,
                        })
                      }
                    />
                  </AdminField>
                </div>
              </div>
            </AdminPanel>

            <AdminPanel
              eyebrow="Context"
              title="Collection signals"
              description="Lightweight reference for the selected collection."
            >
              <div className="grid gap-4 md:grid-cols-3">
                <InfoCard label="Handle" value={`/${selectedCollection.handle}`} />
                <InfoCard
                  label="Description"
                  value={
                    selectedCollection.description
                      ? `${selectedCollection.description.length} chars`
                      : "No description yet"
                  }
                />
                <InfoCard label="Type" value="Merch grouping" />
              </div>
            </AdminPanel>
          </div>
        ) : (
          <AdminEmptyState
            title="Select a collection"
            description="Choose a collection from the browser to edit it."
          />
        )}
      </div>
    </AdminDrawer>
  );
}

function EntityButton({
  label,
  subtitle,
  badge,
  storefronts = [],
  selected,
  onClick,
}: {
  label: string;
  subtitle: string;
  badge: string;
  storefronts?: CategoryRow["storefronts"];
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`admin-lift flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
        selected
          ? "border-cyan-400/30 bg-cyan-400/10"
          : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]"
      }`}
    >
      <div>
        <div className="text-sm font-semibold text-slate-100">{label}</div>
        <div className="mt-1 text-xs text-slate-500">{subtitle}</div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {storefronts.map((storefront) => (
            <span
              key={`${label}-${storefront}`}
              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getStorefrontBadgeTone(
                storefront,
              )}`}
            >
              {formatStorefrontLabel(storefront)}
            </span>
          ))}
        </div>
      </div>
      <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-slate-400">
        {badge}
      </span>
    </button>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
        {label}
      </div>
      <div className="mt-2 text-sm text-slate-200">{value}</div>
    </div>
  );
}
