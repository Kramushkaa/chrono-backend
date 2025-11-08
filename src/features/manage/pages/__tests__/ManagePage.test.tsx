import React from 'react'
import { render } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import ManagePage from '../ManagePage'

type Noop = () => void
function noop(): void {
  return undefined
}

const filtersStub = {
  filters: {},
  setFilters: noop,
  groupingType: 'category' as const,
  setGroupingType: noop,
  yearInputs: { min: '', max: '' },
  setYearInputs: noop,
  applyYearFilter: noop,
  handleYearKeyPress: noop,
  resetAllFilters: noop,
}

const listsStub = {
  personLists: [],
  sharedList: null,
  loadUserLists: { current: noop },
}

const addToListStub = {
  isOpen: false,
  openForPerson: noop,
  openForAchievement: noop,
  openForPeriod: noop,
  close: noop,
  includeLinked: false,
  setIncludeLinked: noop,
  onAdd: noop,
}

const managePageDataStub = {
  personsAlt: [],
  personsAltLoading: false,
  personsAltInitialLoading: false,
  personsAltHasMore: false,
  loadMorePersonsAlt: noop,
  personsAll: [],
  isPersonsLoadingAll: false,
  personsHasMoreAll: false,
  loadMorePersonsAll: noop,
  searchPersons: '',
  setSearchPersons: noop,
  statusFilters: {},
  setStatusFilters: noop,
  achievementsData: [],
  achievementsMineData: [],
  searchAch: '',
  setSearchAch: noop,
  achStatusFilters: {},
  setAchStatusFilters: noop,
  periodsData: [],
  periodsMineData: [],
  searchPeriods: '',
  setSearchPeriods: noop,
  periodsStatusFilters: {},
  setPeriodsStatusFilters: noop,
  resetPersons: noop,
  resetAchievements: noop,
  resetPeriods: noop,
}

const manageStateStub = {
  activeTab: 'persons' as const,
  setActiveTab: noop,
  sidebarCollapsed: false,
  setSidebarCollapsed: noop,
  isScrolled: false,
  showControls: false,
  setShowControls: noop,
  menuSelection: 'all' as const,
  setMenuSelection: noop,
  selectedListId: null as string | null,
  setSelectedListId: noop,
  mineCounts: { persons: 0, achievements: 0, periods: 0 },
  setMineCounts: noop,
  countsLoadKeyRef: { current: 0 },
  countsLastTsRef: { current: 0 },
  fetchedDetailsIdsRef: { current: new Set<string>() },
  lastSelectedRef: { current: null as string | null },
  listItems: [],
  setListItems: noop,
  listItemIdByDomainIdRef: { current: new Map<string, string>() },
  listLoading: false,
  setListLoading: noop,
  selected: null as unknown,
  setSelected: noop,
  categories: [],
  setCategories: noop,
  countries: [],
  setCountries: noop,
  countryOptions: [],
  setCountryOptions: noop,
  lifePeriods: [],
  setLifePeriods: noop,
  editPersonCategory: '',
  setEditPersonCategory: noop,
  editBirthYear: '',
  setEditBirthYear: noop,
  editDeathYear: '',
  setEditDeathYear: noop,
  newLifePeriods: [],
  setNewLifePeriods: noop,
}

const manageModalsStub = {
  showAuthModal: false,
  setShowAuthModal: noop,
  showCreate: false,
  setShowCreate: noop,
  createType: 'person' as const,
  setCreateType: noop,
  isEditing: false,
  setIsEditing: noop,
  showCreateList: false,
  setShowCreateList: noop,
  showEditWarning: false,
  setShowEditWarning: noop,
  isReverting: false,
  setIsReverting: noop,
}

const manageBusinessLogicStub = {
  countrySelectOptions: [],
  categorySelectOptions: [],
}

const authStub = {
  user: null,
  isAuthenticated: false,
}

const toastStub = {
  showToast: noop,
}

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => noop,
  };
})

vi.mock('shared/hooks/useFilters', () => ({
  useFilters: () => filtersStub,
}))

vi.mock('features/persons/utils/groupingUtils', () => ({
  getGroupColor: () => '#000000',
}))

vi.mock('shared/layout/headers/ManageHeader', () => ({
  ManageHeader: ({ children, ...props }: any) => (
    <div data-testid="manage-header" {...props}>
      {children}
    </div>
  ),
}))

vi.mock('features/manage/hooks/useLists', () => ({
  useLists: () => listsStub,
}))

vi.mock('features/manage/hooks/useAddToList', () => ({
  useAddToList: () => addToListStub,
}))

vi.mock('shared/context/AuthContext', () => ({
  useAuth: () => authStub,
}))

vi.mock('shared/context/ToastContext', () => ({
  useToast: () => toastStub,
}))

vi.mock('features/manage/components/AdaptiveTabs', () => ({
  AdaptiveTabs: ({ children, ...props }: any) => (
    <div data-testid="adaptive-tabs" {...props}>
      {children}
    </div>
  ),
}))

vi.mock('features/manage/context/ManageUIContext', () => ({
  ManageUIProvider: ({ children }: any) => (
    <div data-testid="manage-ui-provider">{children}</div>
  ),
}))

vi.mock('../../hooks/useManagePageData', () => ({
  useManagePageData: () => managePageDataStub,
}))

vi.mock('../../hooks/useManageState', () => ({
  useManageState: () => manageStateStub,
}))

vi.mock('../../hooks/useManageModals', () => ({
  useManageModals: () => manageModalsStub,
}))

vi.mock('../../hooks/useManageBusinessLogic', () => ({
  useManageBusinessLogic: () => manageBusinessLogicStub,
}))

vi.mock('../../components/PersonsTab', () => ({
  PersonsTab: ({ children, ...props }: any) => (
    <div data-testid="persons-tab" {...props}>
      {children}
    </div>
  ),
}))

vi.mock('../../components/AchievementsTab', () => ({
  AchievementsTab: ({ children, ...props }: any) => (
    <div data-testid="achievements-tab" {...props}>
      {children}
    </div>
  ),
}))

vi.mock('../../components/PeriodsTab', () => ({
  PeriodsTab: ({ children, ...props }: any) => (
    <div data-testid="periods-tab" {...props}>
      {children}
    </div>
  ),
}))

vi.mock('../../components/ManageModals', () => ({
  ManageModals: ({ children, ...props }: any) => (
    <div data-testid="manage-modals" {...props}>
      {children}
    </div>
  ),
}))

vi.mock('shared/ui/ContactFooter', () => ({
  ContactFooter: ({ children, ...props }: any) => (
    <div data-testid="contact-footer" {...props}>
      {children}
    </div>
  ),
}))

vi.mock('shared/ui/SEO', () => ({
  SEO: ({ children, ...props }: any) => (
    <div data-testid="seo" {...props}>
      {children}
    </div>
  ),
}))

vi.mock('shared/api/api', () => ({
  apiFetch: noop,
  apiData: {},
}))

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  )
}

describe('ManagePage', () => {
  beforeAll(() => {
    const mockLocation = {
      href: 'http://localhost:3000',
      origin: 'http://localhost:3000',
      reload: noop,
    }
    try {
      delete (window as any).location
      Object.defineProperty(window, 'location', {
        value: mockLocation,
        writable: true,
        configurable: true,
      })
    } catch {
      // ignore if redefining fails
    }
  })

  it('should render without crashing', () => {
    renderWithRouter(<ManagePage />)

    const mainElement = document.querySelector('.app.manage-page')
    expect(mainElement).toBeInTheDocument()
    expect(mainElement).toHaveAttribute('id', 'chrononinja-manage')
    expect(mainElement).toHaveAttribute('role', 'main')
  })

  it('should render SEO component', () => {
    renderWithRouter(<ManagePage />)

    const seoElement = document.querySelector('[data-testid="seo"]')
    expect(seoElement).toBeInTheDocument()
  })

  it('should render ManageHeader', () => {
    renderWithRouter(<ManagePage />)

    const headerElement = document.querySelector('[data-testid="manage-header"]')
    expect(headerElement).toBeInTheDocument()
  })

  it('should render AdaptiveTabs', () => {
    renderWithRouter(<ManagePage />)

    const tabsElement = document.querySelector('[data-testid="adaptive-tabs"]')
    expect(tabsElement).toBeInTheDocument()
  })

  it('should render ManageUIProvider', () => {
    renderWithRouter(<ManagePage />)

    const providerElement = document.querySelector('[data-testid="manage-ui-provider"]')
    expect(providerElement).toBeInTheDocument()
  })

  it('should render ContactFooter', () => {
    renderWithRouter(<ManagePage />)

    const footerElement = document.querySelector('[data-testid="contact-footer"]')
    expect(footerElement).toBeInTheDocument()
  })

  it('should render ManageModals', () => {
    renderWithRouter(<ManagePage />)

    const modalsElement = document.querySelector('[data-testid="manage-modals"]')
    expect(modalsElement).toBeInTheDocument()
  })

  it('should render persons tab by default', () => {
    renderWithRouter(<ManagePage />)

    const personsTab = document.querySelector('[data-testid="persons-tab"]')
    expect(personsTab).toBeInTheDocument()
  })

  it('should have proper accessibility attributes', () => {
    renderWithRouter(<ManagePage />)

    const mainElement = document.querySelector('.app.manage-page')
    expect(mainElement).toHaveAttribute('aria-label', 'Управление контентом')
  })
})
