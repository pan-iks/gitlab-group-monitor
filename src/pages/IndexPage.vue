<template>
  <h1 class="text-h4 q-mt-none">Gitlab group monitor</h1>

  <div>
    <q-form
      @submit="onSubmit"
      class="q-gutter-md"
    >
      <div class="row items-start">
        <div class="col-auto col-lg-3">
          <q-input
            filled
            v-model="topGroupId"
            label="Enter group ID"
            hint="Top level group ID"
            dense
            :rules="[(val) => isNumberBlankOrValid(val) || 'Invalid ID Number. Type only digits!']"
          />
        </div>
        <q-btn label="Update" type="submit" color="primary" class="q-ml-sm"/>
      </div>
    </q-form>
  </div>
  <q-separator class="q-mt-md q-mb-sm" />
  <div class="row" :class="$q.screen.lt.md ? 'column' : ''">
    <div class="col-lg-2">
      <h2 class="text-h5 q-mt-none">Structure</h2>
      <q-tree class="text-small"
          :nodes="tree"
          node-key="id"
          label-key="name"
          dense
          default-expand-all
          ref="treeStructure"
        >
        <template v-slot:default-header="prop">
          <div>
            <div class="text-small">(id: {{ prop.node.id }})</div>
            <div class="text-bold">{{ prop.node.name }}</div>
          </div>
        </template>
      </q-tree>
    </div>
    <q-space class="q-pa-sm" />
    <div class="col">
      <h2 class="text-h5 q-mt-none">Users</h2>
      <q-list bordered separator dense>
        <q-item v-for="user in currentResultPageList || []" :key="user.id">
            <q-item-section class="text-small">
              <small>id: {{ user.id }}</small>
              <div><strong>{{ user.name }}</strong> (@{{ user.username }})</div>
              <div>Groups: [
                <!-- span v-for="group in user.groups" :key="group.id">{{ group }}</span -->
                {{ user.groups ? user.groups.join(', ') : '' }}
              ]</div>
              <div>Projects: [
                <!-- span v-for="project in user.projects" :key="project.id">{{ project }}</span -->
                {{ user.projects ? user.projects.join(', ') : '' }}
              ]</div>
            </q-item-section>
          </q-item>
      </q-list>
      <!-- pagination block -->
      <div class="row items-center">
        <div class="col">
          <q-pagination
            v-model="currentPagination"
            :max="currentPagesNum"

            @update:model-value="handlePagination"
          />
        </div>
        <div
          class="col-auto"
          style="min-width: 150px"
        >
          <q-select
            v-model="paginationModel"
            :options="paginationOptions"
            label="users per page"
            @update:model-value="handlePagination"
          />
        </div>
      </div>
      <div>
        TOTAL USERS: {{ users.length }}
      </div>
    </div>
  </div>
  <transition name="fade">
    <div class="bg-white absolute-center full-width full-height" style="z-index: 9;" v-if="showLoading">
        <q-spinner-ios color="blue" class="absolute-center" size="3rem" />
        <div class="text-blue absolute-top q-pa-lg">
          <transition name="fade">
            <div v-if="groupsLoaded">Groups loaded: <span>OK</span></div>
          </transition>
          <transition name="fade">
            <div v-if="projectsLoaded">Projects loaded: <span>OK</span></div>
          </transition>
          <transition name="fade">
            <div v-if="groupsMembersLoaded">Groups members loaded: <span>OK</span></div>
          </transition>
          <transition name="fade">
            <div v-if="projectsMembersLoaded">Projects members loaded: <span>OK</span></div>
          </transition>
        </div>
    </div>
  </transition>
</template>

<script setup>
import { api } from 'boot/axios'
import { ref, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { usePagination } from '../utils/paginatiomUtils'
import accessLevelCodes from '../config/gitlab'

const $q = useQuasar()

const handleNotify = (message, type) => {
  $q.notify({
    type,
    message
  })
}

const accessLevelMap = accessLevelCodes.accessLevelMap
const topGroupId = ref(10975505)
const getGroups = async () => {
  // load group
  try {
    let responseData
    if (!topGroupId.value) {
      const response = await api.get('/groups')
      responseData = response.data
    } else {
      const response = await api.get(`/groups/${topGroupId.value}`)
      response.data.parent_id = null

      const responseD = await api.get(`/groups/${topGroupId.value}/descendant_groups`)
      responseD.data.push(response.data)
      responseData = responseD.data
    }

    return responseData
  } catch (error) {
    console.log('error getting groups')
    if (error.response && error.response.status === 404) {
      // 404 not found
      console.error('Error 404:', error.message)
      handleNotify('Not found', 'negative')
    } else {
      // other errors
      console.error('Server error:', error)
      handleNotify('Server error', 'negative')
    }
    return false
  }
}
const getProjects = async (allGroups) => {
  if (!allGroups) return false

  let projects = []
  for (const group of allGroups) {
    try {
      const response = await api.get(`https://gitlab.com/api/v4/groups/${group.id}/projects`)
      projects = projects.concat(response.data)
    } catch (error) {
      console.log('error getting projects')
      if (error.response && error.response.status === 404) {
        // 404 not found
        console.error('Error 404:', error.message)
        handleNotify('Not found', 'negative')
      } else {
        // other errors
        console.error('Server error:', error)
        handleNotify('Server error', 'negative')
      }
    }
  }
  return projects
}

// tree structures
const tree = ref([])
const createTree = (list) => {
  let node, i
  const map = {}, roots = []

  for (i = 0; i < list.length; i += 1) {
    map[list[i].id] = i // initialize the map
    list[i].children = list[i].children || [] // initialize the children
  }

  for (i = 0; i < list.length; i += 1) {
    node = list[i]
    if (node.parent_id !== null) {
      // if you have dangling branches check that map[node.parentId] exists
      list[map[node.parent_id]].children.push(node)
    } else {
      roots.push(node)
    }
  }
  return roots
}

const addProjects = (projects, treeStructure) => {
  projects.forEach(project => {
    addChilds(treeStructure, project)
  })
}
const addChilds = function (obj, element) {
  const id = element.namespace.id

  for (const key in obj) {
    let parent
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      parent = obj[key]
      if (parent?.id === id) {
        parent.children = parent.children || []
        parent.children.push(element)
      } else {
        addChilds(obj[key], element) // recursive call
      }
    }
  }
}

/*
const iterateObject = function (obj, element, idToItemMap) {
  // console.log('obj: ' + id)
  const id = element.namespace.id
  for (const key in obj) {
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      iterateObject(obj[key], element, idToItemMap) // recursive call
    } else {
      if (key === 'id' && obj[key] === id) {
        console.log(key + ':', obj[key])
      }
    }
  }
}
*/
const isNumberBlankOrValid = (val) => {
  if (val.length === 0) {
    return true
  }
  return isValidNumber(val)
}
const isValidNumber = (val) => val && isNumeric(val)
const isNumeric = (value) => {
  return /^\d+$/.test(value)
}

const users = ref([])

function getAccessLevelText (accessLevelCode) {
  return accessLevelMap[accessLevelCode] || 'Unknown'
}
const getGroupMembers = async (group) => {
  const groupId = group.id

  try {
    const membersResponse = await api.get(`https://gitlab.com/api/v4/groups/${groupId}/members`)
    const data = membersResponse.data
    for (const user of data) {
      if (users.value.some(item => item.id === user.id)) {
        const foundUser = users.value.filter(item => item.id === user.id)[0]
        foundUser.groups = foundUser.groups || []
        foundUser.groups.push(group.full_path + '(' + getAccessLevelText(user.access_level) + ')')
      } else {
        user.groups = user.groups || []
        user.groups.push(group.full_path + '(' + getAccessLevelText(user.access_level) + ')')
        users.value.push(user)
      }
    }
  } catch (error) {
    console.error('Error checking group members:', error)
  }
}

const getAllGroupsMembers = async () => {
  for (const group of allGroups.value) {
    await getGroupMembers(group)
  }
}

const getProjectMembers = async (project) => {
  const projectId = project.id
  try {
    const membersResponse = await api.get(`https://gitlab.com/api/v4/projects/${projectId}/members`)
    const data = membersResponse.data
    for (const user of data) {
      if (users.value.some(item => item.id === user.id)) {
        const foundUser = users.value.filter(item => item.id === user.id)[0]
        foundUser.projects = foundUser.projects || []
        foundUser.projects.push(project.path_with_namespace + '(' + getAccessLevelText(user.access_level) + ')')
      } else {
        user.projects = user.projects || []
        user.projects.push(project.path_with_namespace + '(' + getAccessLevelText(user.access_level) + ')')
        users.value.push(user)
      }
    }
  } catch (error) {
    console.error('Error checking group members:', error)
  }
}

const getAllProjectsMembers = async () => {
  for (const project of allProjects.value) {
    await getProjectMembers(project)
  }
}

const {
  paginationOptions,
  paginationModel,
  currentPagination,
  currentResultPageList,
  currentPagesNum,
  handlePagination
} = usePagination(users)

const allGroups = ref([])
const allProjects = ref([])
const treeStructure = ref(null)

const groupsLoaded = ref(false)
const projectsLoaded = ref(false)
const groupsMembersLoaded = ref(false)
const projectsMembersLoaded = ref(false)
const update = async () => {
  groupsLoaded.value = false
  projectsLoaded.value = false
  groupsMembersLoaded.value = false
  projectsMembersLoaded.value = false

  showLoading.value = true
  users.value = []
  allGroups.value = await getGroups()
  if (!allGroups.value) {
    showLoading.value = false
    return false
  }
  groupsLoaded.value = true
  allProjects.value = await getProjects(allGroups.value)
  if (!allProjects.value) {
    showLoading.value = false
    return false
  }
  projectsLoaded.value = true

  tree.value = createTree(allGroups.value)

  addProjects(allProjects.value, tree.value)

  await getAllGroupsMembers()
  groupsMembersLoaded.value = true
  await getAllProjectsMembers()
  projectsMembersLoaded.value = true
  handlePagination()
  if ($q.screen.gt.md) {
    treeStructure.value.expandAll()
  }

  setTimeout(function () {
    showLoading.value = false
  }, 1500)

  console.log('done')
}

const onSubmit = () => {
  update()
}
const showLoading = ref(true)
onMounted(() => {
  update()
})

</script>
